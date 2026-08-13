// functions/lib/turnstile.js
// Cloudflare Turnstile server-side verification helper.
// Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
//
// Usage:
//   import { verifyTurnstile } from '../lib/turnstile.js';
//   const { ok, reason } = await verifyTurnstile(env, token, request);
//   if (!ok) return json({ error: 'Captcha failed', reason }, 403);

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verify a Turnstile token against Cloudflare.
 * Fail-open ONLY when no secret is configured (dev mode).
 *
 * @param {Object} env - Cloudflare bindings. Expects env.TURNSTILE_SECRET_KEY.
 * @param {string} token - The token from `cf-turnstile-response` form field.
 * @param {Request} [request] - Optional, used to extract CF-Connecting-IP.
 * @returns {Promise<{ok:boolean, reason?:string, raw?:object}>}
 */
export async function verifyTurnstile(env, token, request = null) {
  const secret = env?.TURNSTILE_SECRET_KEY;

  // No secret configured → dev mode: skip verification but warn.
  if (!secret) {
    if (env?.ENVIRONMENT !== 'production') {
      return { ok: true, reason: 'turnstile_disabled_dev' };
    }
    return { ok: false, reason: 'turnstile_not_configured' };
  }

  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing_token' };
  }

  const params = new URLSearchParams();
  params.append('secret', secret);
  params.append('response', token);

  const ip =
    request?.headers?.get?.('CF-Connecting-IP') ||
    request?.headers?.get?.('X-Forwarded-For')?.split(',')[0]?.trim();
  if (ip) params.append('remoteip', ip);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body: params,
    });
    const data = await res.json();

    if (data?.success) {
      return { ok: true, raw: data };
    }
    return {
      ok: false,
      reason: Array.isArray(data?.['error-codes']) && data['error-codes'].length
        ? data['error-codes'].join(',')
        : 'verification_failed',
      raw: data,
    };
  } catch (err) {
    console.error('Turnstile verify error:', err?.message || err);
    return { ok: false, reason: 'turnstile_network_error' };
  }
}
