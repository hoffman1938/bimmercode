// functions/api/admin/moderation/warn.js
// POST /api/admin/moderation/warn
// Body: { user_id, reason, severity?, expires_at? }
// Writes into the existing `warnings` table (schema.sql) —
// columns: id, user_id, moderator_id, reason, severity, expires_at, is_active.

import { authenticateAdminRequest } from "../../../lib/admin-gate.js";
import { logAudit, AUDIT_ACTIONS } from "../../../lib/audit.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SEVERITIES = ["minor", "major", "severe"];

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const moderatorId = auth.userId;

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  let {
    user_id,
    reason,
    severity = "minor",
    expires_at = null,
  } = body || {};

  // Map from v2 scale ('low|medium|high|critical') to existing scale
  const sevMap = { low: "minor", medium: "minor", high: "major", critical: "severe" };
  if (sevMap[severity]) severity = sevMap[severity];

  if (!user_id || !reason) return json({ error: "user_id and reason required" }, 400);
  if (!SEVERITIES.includes(severity)) return json({ error: `severity must be one of ${SEVERITIES.join(", ")}` }, 400);

  try {
    const u = await env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(user_id).first();
    if (!u) return json({ error: "User not found" }, 404);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO warnings
         (id, user_id, moderator_id, reason, severity, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    ).bind(id, user_id, moderatorId, String(reason).slice(0, 2000), severity, expires_at).run();

    try {
      await env.DB.prepare(
        `INSERT INTO notifications (id, user_id, type, title, text, icon)
         VALUES (?, ?, 'warning', ?, ?, 'fa-exclamation-triangle')`
      ).bind(crypto.randomUUID(), user_id, "You received a warning", String(reason).slice(0, 240)).run();
    } catch { /* optional */ }

    try {
      await logAudit(env, {
        userId: moderatorId,
        action: AUDIT_ACTIONS.WARNING_ISSUED,
        targetEntityType: "user",
        targetEntityId: user_id,
        targetUserId: user_id,
        details: { severity, reason: String(reason).slice(0, 500) },
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
