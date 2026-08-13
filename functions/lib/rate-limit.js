// functions/lib/rate-limit.js - Rate Limiting System

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
  REGISTRATION: {
    maxAttempts: 3,
    windowMinutes: 60,
    key: 'reg'
  },
  LOGIN: {
    maxAttempts: 5,
    windowMinutes: 15,
    key: 'login'
  },
  PASSWORD_RECOVERY: {
    maxAttempts: 3,
    windowMinutes: 60,
    key: 'pwd_recovery'
  },
  API_GENERAL: {
    maxAttempts: 100,
    windowMinutes: 1,
    key: 'api'
  },
  VOTE: {
    maxAttempts: 20,
    windowMinutes: 1440, // 24 hours
    key: 'vote'
  },
  // -------- Forum-specific --------
  FORUM_NEW_TOPIC: {
    maxAttempts: 5,
    windowMinutes: 60,
    key: 'forum_topic_new'
  },
  FORUM_REPLY: {
    maxAttempts: 20,
    windowMinutes: 15,
    key: 'forum_reply'
  },
  FORUM_REACTION: {
    maxAttempts: 60,
    windowMinutes: 15,
    key: 'forum_react'
  },
  FORUM_REPORT: {
    maxAttempts: 10,
    windowMinutes: 60,
    key: 'forum_report'
  },
  UPLOAD: {
    maxAttempts: 30,
    windowMinutes: 60,
    key: 'upload'
  },
  SEARCH: {
    maxAttempts: 120,
    windowMinutes: 1,
    key: 'search'
  },
  /** AI assistant widget — burst + generous daily free tier */
  AI_CHAT_BURST: {
    maxAttempts: 8,
    windowMinutes: 1,
    key: 'ai_chat_burst'
  },
  AI_CHAT_DAILY: {
    maxAttempts: 40,
    windowMinutes: 1440,
    key: 'ai_chat_day'
  }
};

/**
 * Check if an action is rate limited
 * @param {Object} env - Cloudflare environment (KV binding for rate limiting)
 * @param {string} identifier - Unique identifier (IP address, user ID, etc.)
 * @param {Object} config - Rate limit configuration
 * @returns {Promise<Object>} - {allowed: boolean, remaining: number, resetAt: Date}
 */
export async function checkRateLimit(env, identifier, config) {
  const { maxAttempts, windowMinutes, key } = config;
  const rateLimitKey = `ratelimit:${key}:${identifier}`;
  
  try {
    // Get current count from KV (if available) or use in-memory fallback
    const kvData = env.RATE_LIMIT_KV 
      ? await env.RATE_LIMIT_KV.get(rateLimitKey, 'json')
      : null;
    
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    
    if (!kvData || now > kvData.resetAt) {
      // New window or expired
      const resetAt = now + windowMs;
      
      if (env.RATE_LIMIT_KV) {
        await env.RATE_LIMIT_KV.put(
          rateLimitKey,
          JSON.stringify({ count: 1, resetAt }),
          { expirationTtl: windowMinutes * 60 }
        );
      }
      
      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetAt: new Date(resetAt)
      };
    }
    
    // Check if limit exceeded
    if (kvData.count >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(kvData.resetAt)
      };
    }
    
    // Increment count
    const newCount = kvData.count + 1;
    
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(
        rateLimitKey,
        JSON.stringify({ count: newCount, resetAt: kvData.resetAt }),
        { expirationTtl: Math.ceil((kvData.resetAt - now) / 1000) }
      );
    }
    
    return {
      allowed: true,
      remaining: maxAttempts - newCount,
      resetAt: new Date(kvData.resetAt)
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: maxAttempts,
      resetAt: new Date(Date.now() + windowMinutes * 60 * 1000)
    };
  }
}

/**
 * Middleware to enforce rate limiting
 * @param {Object} config - Rate limit configuration
 * @param {Function} getIdentifier - Function to extract identifier from request
 * @returns {Function} - Middleware function
 */
export function rateLimitMiddleware(config, getIdentifier) {
  return async (request, env) => {
    const identifier = await getIdentifier(request);
    const rateLimit = await checkRateLimit(env, identifier, config);
    
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        resetAt: rateLimit.resetAt.toISOString()
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((rateLimit.resetAt - new Date()) / 1000).toString()
        }
      });
    }
    
    return null; // Rate limit passed
  };
}

/**
 * Get IP address from request
 * @param {Request} request - Cloudflare request object
 * @returns {string} - IP address
 */
export function getIpAddress(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0] ||
         'unknown';
}

/**
 * Track failed login attempt
 * @param {Object} env - Cloudflare environment
 * @param {string} identifier - Username or email
 * @param {string} ipAddress - IP address
 * @param {string} reason - Failure reason
 * @param {string} userAgent - User agent string
 * @returns {Promise<void>}
 */
export async function trackLoginAttempt(env, identifier, ipAddress, success, reason = null, userAgent = null) {
  try {
    const { generateId } = await import('./utils.js');
    
    await env.DB.prepare(`
      INSERT INTO login_attempts (
        id, identifier, ip_address, success, failure_reason, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      identifier,
      ipAddress,
      success ? 1 : 0,
      reason,
      userAgent
    ).run();
    
    // If failed, increment user's failed attempt counter
    if (!success) {
      await env.DB.prepare(`
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1
        WHERE email = ? OR username = ?
      `).bind(identifier, identifier).run();
    } else {
      // On success, reset failed attempts
      await env.DB.prepare(`
        UPDATE users 
        SET failed_login_attempts = 0, last_login = CURRENT_TIMESTAMP
        WHERE email = ? OR username = ?
      `).bind(identifier, identifier).run();
    }
  } catch (error) {
    console.error('Track login attempt error:', error);
  }
}

/**
 * Check if account is locked due to failed attempts
 * @param {Object} env - Cloudflare environment
 * @param {string} identifier - Username or email
 * @returns {Promise<Object>} - {locked: boolean, lockedUntil: Date|null}
 */
export async function checkAccountLock(env, identifier) {
  try {
    const user = await env.DB.prepare(`
      SELECT failed_login_attempts, account_locked_until
      FROM users
      WHERE email = ? OR username = ?
    `).bind(identifier, identifier).first();
    
    if (!user) {
      return { locked: false, lockedUntil: null };
    }
    
    // Check if account is currently locked
    if (user.account_locked_until) {
      const lockedUntil = new Date(user.account_locked_until);
      if (lockedUntil > new Date()) {
        return { locked: true, lockedUntil };
      } else {
        // Lock expired, clear it
        await env.DB.prepare(`
          UPDATE users 
          SET account_locked_until = NULL, failed_login_attempts = 0
          WHERE email = ? OR username = ?
        `).bind(identifier, identifier).run();
        
        return { locked: false, lockedUntil: null };
      }
    }
    
    // Check if should be locked (5+ failed attempts)
    if (user.failed_login_attempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      await env.DB.prepare(`
        UPDATE users 
        SET account_locked_until = ?
        WHERE email = ? OR username = ?
      `).bind(lockUntil.toISOString(), identifier, identifier).run();
      
      return { locked: true, lockedUntil: lockUntil };
    }
    
    return { locked: false, lockedUntil: null };
  } catch (error) {
    console.error('Check account lock error:', error);
    return { locked: false, lockedUntil: null };
  }
}
