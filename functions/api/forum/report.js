// functions/api/forum/report.js
// User-submitted report on a post / topic / user.
//
// POST /api/forum/report
// Body: { entity_type: 'post'|'topic'|'user', entity_id, reason, details? }
// Requires: Bearer auth, rate-limited.

import { verifyToken } from "../../lib/jwt.js";
import { checkRateLimit, RATE_LIMITS, getIpAddress } from "../../lib/rate-limit.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ALLOWED_ENTITIES = ["post", "topic", "user"];
const ALLOWED_REASONS = [
  "spam", "abuse", "hate_speech", "off_topic",
  "nsfw", "illegal", "scam", "other",
];

export async function onRequestPost(context) {
  const { request, env } = context;

  // Auth
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const secret = env.JWT_SECRET || "secret-dev-key";
  const payload = token ? await verifyToken(token, secret) : null;
  if (!payload?.id) return json({ error: "Authentication required" }, 401);

  // Rate limit
  const ip = getIpAddress(request);
  const rl = await checkRateLimit(env, payload.id, RATE_LIMITS.FORUM_REPORT);
  if (!rl.allowed) return json({ error: "Too many reports. Try again later." }, 429);
  const rl2 = await checkRateLimit(env, `ip:${ip}`, RATE_LIMITS.FORUM_REPORT);
  if (!rl2.allowed) return json({ error: "Too many reports from this IP." }, 429);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { entity_type, entity_id, reason, details } = body || {};
  if (!entity_type || !entity_id || !reason) {
    return json({ error: "entity_type, entity_id and reason are required" }, 400);
  }
  if (!ALLOWED_ENTITIES.includes(entity_type)) {
    return json({ error: "Invalid entity_type" }, 400);
  }
  const reasonNorm = String(reason).toLowerCase().trim();
  if (!ALLOWED_REASONS.includes(reasonNorm)) {
    return json({ error: `Reason must be one of: ${ALLOWED_REASONS.join(", ")}` }, 400);
  }
  const detailsStr = typeof details === "string" ? details.slice(0, 1000) : null;

  try {
    // Refuse duplicate open report from same user on same entity
    const existing = await env.DB.prepare(
      `SELECT id FROM reports
        WHERE reporter_id = ? AND entity_type = ? AND entity_id = ?
          AND status IN ('open','reviewing')`
    ).bind(payload.id, entity_type, entity_id).first();
    if (existing) {
      return json({ success: true, duplicate: true, id: existing.id });
    }

    const reportId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO reports
         (id, reporter_id, entity_type, entity_id, reason, details)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(reportId, payload.id, entity_type, entity_id, reasonNorm, detailsStr).run();

    return json({ success: true, id: reportId }, 201);
  } catch (e) {
    console.error("report error:", e);
    return json({ error: e.message }, 500);
  }
}
