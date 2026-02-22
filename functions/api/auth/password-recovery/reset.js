// functions/api/auth/password-recovery/reset.js - Step 3: Reset Password

import { hashPassword, validatePasswordStrength } from "../../../lib/crypto.js";
import { logAudit, AUDIT_ACTIONS } from "../../../lib/audit.js";
import { getIpAddress } from "../../../lib/rate-limit.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);

  try {
    const { reset_token, new_password } = await request.json();

    if (!reset_token || !new_password) {
      return new Response(JSON.stringify({ error: "Missing token or password" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Password Strength Validation
    const passwordValidation = validatePasswordStrength(new_password);
    if (!passwordValidation.valid) {
      return new Response(JSON.stringify({ 
        error: "Password too weak",
        details: passwordValidation.errors
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Verify Token
    const user = await env.DB.prepare(
      "SELECT id, email FROM users WHERE verification_token = ?"
    )
      .bind(reset_token)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid or expired reset token" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Update Password
    const newHash = await hashPassword(new_password);

    // Clear verification token so it can't be used again
    await env.DB.prepare(
      "UPDATE users SET password_hash = ?, verification_token = NULL WHERE id = ?"
    ).bind(newHash, user.id).run();

    // 4. Audit Log
    await logAudit(env, {
      userId: user.id,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      targetEntityType: 'user',
      targetEntityId: user.id,
      details: {
        change: 'password_reset_recovery',
        ip: ipAddress
      },
      ipAddress,
      userAgent: request.headers.get('User-Agent')
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Password successfully reset"
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error("Reset Error:", e);
    return new Response(JSON.stringify({ error: "Password reset failed" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
