// functions/api/auth/login.js - Enhanced Login API
import { generateToken } from "../../lib/jwt.js";
import { verifyPassword } from "../../lib/crypto.js";
import { 
  checkRateLimit, 
  RATE_LIMITS, 
  getIpAddress,
  trackLoginAttempt,
  checkAccountLock
} from "../../lib/rate-limit.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";
import { getUserPermissions, getUserRole } from "../../lib/permissions.js";
import { getUserLevel } from "../../lib/reputation.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  const userAgent = request.headers.get('User-Agent');

  try {
    // 1. Rate Limiting (IP based)
    const rateLimit = await checkRateLimit(env, ipAddress, RATE_LIMITS.LOGIN);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ 
        error: "Too many login attempts. Please try again later.",
        resetAt: rateLimit.resetAt.toISOString()
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimit.resetAt - new Date()) / 1000).toString()
        }
      });
    }

    const { email, password, remember_me } = await request.json(); // 'email' field can contain email OR username
    const identifier = String(email || "").trim();
    const identifierLower = identifier.toLowerCase();

    if (!identifier || !password) {
      return new Response(JSON.stringify({ error: "Username/Email and password are required" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Check Account Lockout
    const lockStatus = await checkAccountLock(env, identifier);
    if (lockStatus.locked) {
      const remainingMinutes = Math.ceil((lockStatus.lockedUntil - new Date()) / 60000);
      
      // Log attempted login on locked account
      await trackLoginAttempt(env, identifier, ipAddress, false, 'account_locked', userAgent);
      
      return new Response(JSON.stringify({ 
        error: `Account is temporarily locked due to multiple failed attempts. Please try again in ${remainingMinutes} minutes.` 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Find user by email OR username
    const user = await env.DB.prepare(
      "SELECT * FROM users WHERE LOWER(email) = ? OR username = ? OR LOWER(username) = ?"
    )
      .bind(identifierLower, identifier, identifierLower)
      .first();

    if (!user) {
      // Log failed attempt (user not found) - vague error for security
      await trackLoginAttempt(env, identifier, ipAddress, false, 'user_not_found', userAgent);
      // Wait a bit to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Verify Password
    let isValid = false;
    try {
      isValid = await verifyPassword(password, user.password_hash);
    } catch (verifyErr) {
      console.error("Password verify error:", verifyErr);
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isValid) {
      // Log failed attempt (wrong password)
      await trackLoginAttempt(env, identifier, ipAddress, false, 'invalid_password', userAgent);
      
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // 5. Check if active
    if (!user.is_active) {
       await trackLoginAttempt(env, identifier, ipAddress, false, 'account_disabled', userAgent);
       return new Response(JSON.stringify({ error: "Account is disabled. Please contact support." }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. Login Success - Track and Audit
    await trackLoginAttempt(env, identifier, ipAddress, true, null, userAgent);
    
    await logAudit(env, {
      userId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      targetEntityType: 'user',
      targetEntityId: user.id,
      targetUserId: user.id,
      details: {
        method: identifier.includes('@') ? 'email' : 'username',
        ip: ipAddress
      },
      ipAddress,
      userAgent
    });

    // 7. Get Role, Permissions and Level Data
    const permissions = await getUserPermissions(env, user.id);
    const role = await getUserRole(env, user.id);
    let level = null;
    try {
      level = await getUserLevel(env, user.reputation || 0, user.preferred_lang || 'en');
    } catch (levelErr) {
      console.error("getUserLevel failed:", levelErr);
    }

    // 8. Generate Token
    const secret = env.JWT_SECRET || "secret-dev-key";
    
    // Token expires in 30 days if remember_me is true, otherwise 24 hours
    const expirationSeconds = remember_me ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    
    const token = await generateToken(
      {
        id: user.id,
        username: user.username,
        role: role?.name || 'user',
        role_level: role?.level || 1,
        permissions: permissions
      },
      secret,
      { expiresIn: expirationSeconds }
    );

    // 9. Update last login (optional column — old DBs may lack it)
    try {
      await env.DB.prepare(
        "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(user.id).run();
    } catch (loginTsErr) {
      console.warn("last_login update skipped:", loginTsErr?.message || loginTsErr);
    }

    // 10. Return Response
    return new Response(
      JSON.stringify({
        success: true,
        token: token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          age: user.age,
          avatar_url: user.avatar_url,
          lang: user.preferred_lang,
          role: role?.name || 'user',
          role_display: role?.display_name || 'User',
          bio: user.bio,
          car_model: user.car_model,
          reputation: user.reputation || 0,
          level: level,
          permissions: permissions
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error("Login Error:", e);
    const msg = e?.message || String(e);
    return new Response(
      JSON.stringify({
        error: "Login failed. Please try again.",
        detail: msg.includes("no such") || msg.includes("D1_ERROR") ? "database_schema" : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
