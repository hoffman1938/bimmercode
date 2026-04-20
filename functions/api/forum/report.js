// functions/api/forum/report.js
// User-submitted report on a post / topic / user.
// Uses the existing `reports` table defined in schema.sql:
//   id, reporter_id, reported_entity_type, reported_entity_id,
//   reported_user_id, reason, description, status ('pending'|'resolved'|'dismissed'),
//   moderator_id, resolution_notes, created_at, resolved_at

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

  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const secret = env.JWT_SECRET || "secret-dev-key";
  const payload = token ? await verifyToken(token, secret) : null;
  if (!payload?.id) return json({ error: "Authentication required" }, 401);

  const ip = getIpAddress(request);
  const rl = await checkRateLimit(env, payload.id, RATE_LIMITS.FORUM_REPORT);
  if (!rl.allowed) return json({ error: "Too many reports. Try again later." }, 429);
  const rl2 = await checkRateLimit(env, `ip:${ip}`, RATE_LIMITS.FORUM_REPORT);
  if (!rl2.allowed) return json({ error: "Too many reports from this IP." }, 429);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const {
    entity_type,
    entity_id,
    reason,
    details,          // preferred new name
    description,      // legacy field name also accepted
  } = body || {};

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
  const descriptionStr =
    typeof details === "string" ? details.slice(0, 1000) :
    typeof description === "string" ? description.slice(0, 1000) : null;

  try {
    // Resolve reported_user_id when possible (owner of the post/topic, or user itself)
    let reportedUserId = null;
    if (entity_type === "user") {
      reportedUserId = entity_id;
    } else if (entity_type === "post") {
      const p = await env.DB.prepare("SELECT user_id FROM posts WHERE id = ?").bind(entity_id).first();
      reportedUserId = p?.user_id || null;
    } else if (entity_type === "topic") {
      const t = await env.DB.prepare("SELECT user_id FROM topics WHERE id = ?").bind(entity_id).first();
      reportedUserId = t?.user_id || null;
    }

    // Refuse duplicate open report from same user on same entity
    const existing = await env.DB.prepare(
      `SELECT id FROM reports
        WHERE reporter_id = ? AND reported_entity_type = ? AND reported_entity_id = ?
          AND status = 'pending'`
    ).bind(payload.id, entity_type, entity_id).first();
    if (existing) {
      return json({ success: true, duplicate: true, id: existing.id });
    }

    const reportId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO reports
         (id, reporter_id, reported_entity_type, reported_entity_id,
          reported_user_id, reason, description, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
    ).bind(
      reportId,
      payload.id,
      entity_type,
      entity_id,
      reportedUserId,
      reasonNorm,
      descriptionStr,
    ).run();

    return json({ success: true, id: reportId }, 201);
  } catch (e) {
    console.error("report error:", e);
    return json({ error: e.message }, 500);
  }
}
