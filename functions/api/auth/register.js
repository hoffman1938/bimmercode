// functions/api/auth/register.js - Enhanced Registration API
import { generateId } from "../../lib/utils.js";
import { 
  hashPassword, 
  hashSecurityAnswer, 
  validatePasswordStrength 
} from "../../lib/crypto.js";
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  getIpAddress 
} from "../../lib/rate-limit.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.clone().json();
    const { 
      email, 
      username, 
      password, 
      first_name,
      last_name,
      age,
      security_question, 
      security_answer,
      language
    } = body;

    // 1. Rate Limiting - Check IP address
    const ipAddress = getIpAddress(request);
    const rateLimit = await checkRateLimit(env, ipAddress, RATE_LIMITS.REGISTRATION);
    
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ 
        error: "Too many registration attempts. Please try again later.",
        resetAt: rateLimit.resetAt.toISOString()
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimit.resetAt - new Date()) / 1000).toString()
        }
      });
    }

    // 2. Validate required fields
    if (!email || !username || !password || !security_question || !security_answer) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields",
        required: ["email", "username", "password", "security_question", "security_answer"]
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ 
        error: "Invalid email format" 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Validate username (3-20 chars, alphanumeric + underscore)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return new Response(JSON.stringify({ 
        error: "Username must be 3-20 characters (letters, numbers, underscore only)" 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return new Response(JSON.stringify({ 
        error: "Password does not meet requirements",
        details: passwordValidation.errors
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Validate age if provided
    if (age && (age < 13 || age > 120)) {
      return new Response(JSON.stringify({ 
        error: "Age must be between 13 and 120" 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 7. Check for existing user
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ? OR username = ?"
    ).bind(email, username).first();

    if (existing) {
      return new Response(JSON.stringify({ 
        error: "Email or username already exists" 
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 8. Hash password and security answer
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const answerHash = await hashSecurityAnswer(security_answer);

    // 9. Create user with default role
    await env.DB.prepare(`
      INSERT INTO users (
        id, email, username, password_hash, 
        role_id, preferred_lang,
        security_question, security_answer_hash,
        first_name, last_name, age,
        reputation, is_active, email_verified,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      userId, 
      email, 
      username, 
      passwordHash,
      'user_role', // Default role
      language || 'en',
      security_question,
      answerHash,
      first_name || null,
      last_name || null,
      age || null,
      0, // Initial reputation
      1, // Active
      0  // Email not verified
    ).run();

    // 10. Log registration in audit log
    await logAudit(env, {
      userId: userId,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      targetEntityType: 'user',
      targetEntityId: userId,
      targetUserId: userId,
      details: {
        username,
        email,
        registrationIp: ipAddress
      },
      ipAddress,
      userAgent: request.headers.get('User-Agent')
    });

    // 11. Return success (don't return sensitive data)
    return new Response(JSON.stringify({ 
      success: true,
      user: {
        id: userId,
        username,
        email
      }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return new Response(JSON.stringify({ 
      error: "Registration failed. Please try again." 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
