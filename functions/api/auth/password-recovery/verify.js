// functions/api/auth/password-recovery/verify.js - Step 2: Verify Security Answer

import { verifySecurityAnswer, generateToken } from "../../../lib/crypto.js";
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  getIpAddress 
} from "../../../lib/rate-limit.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);

  try {
    // 1. Rate Limiting
    const rateLimit = await checkRateLimit(env, ipAddress, RATE_LIMITS.PASSWORD_RECOVERY);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ 
        error: "Too many attempts. Please try again later.",
        resetAt: rateLimit.resetAt.toISOString()
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimit.resetAt - new Date()) / 1000).toString()
        }
      });
    }

    const { recovery_token, security_answer } = await request.json();

    if (!recovery_token || !security_answer) {
      return new Response(JSON.stringify({ error: "Missing token or answer" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Verify Token
    // We are using verification_token column temporarily for recovery flow
    const user = await env.DB.prepare(
      "SELECT id, security_answer_hash FROM users WHERE verification_token = ?"
    )
      .bind(recovery_token)
      .first();

    if (!user) {
      // Invalid token
      return new Response(JSON.stringify({ error: "Invalid or expired recovery token" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Verify Security Answer
    const isValid = await verifySecurityAnswer(security_answer, user.security_answer_hash);

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Incorrect answer" }), {
        status: 400, // Or 401
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Generate Reset Token (valid for password change)
    // In a real app, this should be a JWT or signed token with expiration.
    // Here we generate a new random token and update DB.
    const resetToken = generateToken(64); // Longer token for reset

    await env.DB.prepare(
      "UPDATE users SET verification_token = ? WHERE id = ?"
    ).bind(resetToken, user.id).run();

    return new Response(JSON.stringify({
      success: true,
      reset_token: resetToken // Used in Step 3
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error("Verify Error:", e);
    return new Response(JSON.stringify({ error: "Verification failed" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
