// functions/api/admin/moderation/warn.js
// POST /api/admin/moderation/warn
// Body: { user_id, reason, severity?, related_post_id?, related_topic_id?, expires_at? }

import { verifyToken } from "../../../lib/jwt.js";
import { requirePermission } from "../../../lib/permissions.js";
import { logAudit, AUDIT_ACTIONS } from "../../../lib/audit.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SEVERITIES = ["low", "medium", "high", "critical"];

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const secret = env.JWT_SECRET || "secret-dev-key";
  const payload = token ? await verifyToken(token, secret) : null;
  if (!payload?.id) return json({ error: "Unauthorized" }, 401);

  const err = await requirePermission("moderate_content")(context, payload.id);
  if (err) return err;

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const {
    user_id,
    reason,
    severity = "medium",
    related_post_id = null,
    related_topic_id = null,
    expires_at = null,
  } = body || {};

  if (!user_id || !reason) return json({ error: "user_id and reason required" }, 400);
  if (!SEVERITIES.includes(severity)) return json({ error: "Invalid severity" }, 400);

  try {
    const u = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(user_id).first();
    if (!u) return json({ error: "User not found" }, 404);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO user_warnings
         (id, user_id, issued_by, reason, severity, related_post_id, related_topic_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, user_id, payload.id, String(reason).slice(0, 2000), severity, related_post_id, related_topic_id, expires_at).run();

    // Optional notification to the user
    try {
      await env.DB.prepare(
        `INSERT INTO notifications (id, user_id, type, title, text, icon)
         VALUES (?, ?, 'warning', ?, ?, 'fa-exclamation-triangle')`
      ).bind(crypto.randomUUID(), user_id, "You received a warning", String(reason).slice(0, 240)).run();
    } catch { /* optional */ }

    try {
      await logAudit(env, {
        userId: payload.id,
        action: AUDIT_ACTIONS.WARNING_ISSUED,
        targetEntityType: "user",
        targetEntityId: user_id,
        targetUserId: user_id,
        details: { severity, reason: String(reason).slice(0, 500), related_post_id, related_topic_id },
        ipAddress: request.headers.get("CF-Connecting-IP") || null,
        userAgent: request.headers.get("User-Agent") || null,
      });
    } catch { /* non-fatal */ }

    return json({ success: true, id });
  } catch (e) {
    console.error("warn error:", e);
    return json({ error: e.message }, 500);
  }
}
