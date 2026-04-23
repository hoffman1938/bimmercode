// functions/api/upload.js - Hardened image upload endpoint.
//
// Clients should send WebP (see js/image-to-webp.js) so R2 stays small; server still accepts
// jpeg/png/gif/webp after magic-byte checks.
//
// Security:
//   - Auth required (Bearer token)
//   - Rate-limited per user + per IP
//   - Optional Turnstile token (header `cf-turnstile-response`)
//   - Strict MIME + magic-byte validation via moderateImage()
//   - Max file size enforced by moderateImage (10 MB)
//   - Stored in R2 with a randomized name and the verified content type

import { verifyToken } from '../lib/jwt.js';
import { checkRateLimit, RATE_LIMITS, getIpAddress } from '../lib/rate-limit.js';
import { moderateImage } from '../lib/moderation.js';
import { verifyTurnstile } from '../lib/turnstile.js';

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function extFor(mime) {
  return (
    {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }[mime] || 'bin'
  );
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 1. Auth — mandatory
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const secret = env.JWT_SECRET || 'secret-dev-key';
  const payload = token ? await verifyToken(token, secret) : null;
  if (!payload?.id) {
    return json({ error: 'Authentication required' }, 401);
  }
  const userId = payload.id;

  // 2. Rate limit (per user, then per IP)
  const ip = getIpAddress(request);
  const userLimit = await checkRateLimit(env, userId, RATE_LIMITS.UPLOAD);
  if (!userLimit.allowed) {
    return json(
      { error: 'Too many uploads. Please slow down.', resetAt: userLimit.resetAt.toISOString() },
      429,
      { 'Retry-After': Math.ceil((userLimit.resetAt - new Date()) / 1000).toString() }
    );
  }
  const ipLimit = await checkRateLimit(env, `ip:${ip}`, RATE_LIMITS.UPLOAD);
  if (!ipLimit.allowed) {
    return json(
      { error: 'Too many uploads from this IP.', resetAt: ipLimit.resetAt.toISOString() },
      429
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return json({ error: 'No file uploaded' }, 400);
    }

    // 3. Optional Turnstile (if present)
    const turnstileToken =
      formData.get('cf-turnstile-response') ||
      request.headers.get('cf-turnstile-response');
    if (turnstileToken) {
      const ts = await verifyTurnstile(env, String(turnstileToken), request);
      if (!ts.ok) {
        return json({ error: 'Captcha failed', reason: ts.reason }, 403);
      }
    }

    // 4. Strict file validation (size + MIME whitelist + magic bytes)
    const check = await moderateImage(env, file, {
      entityType: 'image',
      userId,
    });
    if (check.decision !== 'approve') {
      return json({ error: check.reason || 'File rejected' }, 400);
    }

    // 5. Store in R2 under a UUID with the validated content type
    if (!env.BUCKET) {
      return json({ error: 'Storage not configured' }, 500);
    }
    const filename = `${crypto.randomUUID()}.${extFor(file.type)}`;
    await env.BUCKET.put(filename, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000' },
      customMetadata: {
        uploadedBy: String(userId),
        originalName: file.name || '',
      },
    });

    return json({ url: `/images/${filename}`, name: filename, size: file.size, type: file.type });
  } catch (err) {
    console.error('Upload error:', err?.message || err);
    return json({ error: 'Upload failed' }, 500);
  }
}
