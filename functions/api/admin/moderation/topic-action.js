// functions/api/admin/moderation/topic-action.js
// Direct moderation actions on a topic (no report required).
//
// POST /api/admin/moderation/topic-action
// Body: { topic_id, action }
//   action ∈ 'lock' | 'unlock' | 'pin' | 'unpin' | 'archive' | 'unarchive'

import { verifyToken } from "../../../lib/jwt.js";
import { requirePermission } from "../../../lib/permissions.js";
import { logAudit, AUDIT_ACTIONS } from "../../../lib/audit.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ACTIONS = {
  lock:      { col: "is_locked",    value: 1, audit: AUDIT_ACTIONS.TOPIC_LOCKED },
  unlock:    { col: "is_locked",    value: 0, audit: AUDIT_ACTIONS.TOPIC_UNLOCKED },
  pin:       { col: "is_pinned",    value: 1, audit: AUDIT_ACTIONS.TOPIC_PINNED },
  unpin:     { col: "is_pinned",    value: 0, audit: AUDIT_ACTIONS.TOPIC_UNPINNED },
  archive:   { col: "is_archived",  value: 1, audit: AUDIT_ACTIONS.TOPIC_ARCHIVED },
  unarchive: { col: "is_archived",  value: 0, audit: AUDIT_ACTIONS.TOPIC_ARCHIVED },
};

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
  const { topic_id, action } = body || {};
  if (!topic_id || !action) return json({ error: "topic_id and action required" }, 400);
  const cfg = ACTIONS[action];
  if (!cfg) return json({ error: `Unknown action. Allowed: ${Object.keys(ACTIONS).join(", ")}` }, 400);

  try {
    const topic = await env.DB.prepare("SELECT id, user_id FROM topics WHERE id = ?").bind(topic_id).first();
    if (!topic) return json({ error: "Topic not found" }, 404);

    await env.DB.prepare(`UPDATE topics SET ${cfg.col} = ? WHERE id = ?`).bind(cfg.value, topic_id).run();

    try {
      await logAudit(env, {
        userId: payload.id,
        action: cfg.audit,
        targetEntityType: "topic",
        targetEntityId: topic_id,
        targetUserId: topic.user_id,
        details: { action },
        ipAddress: request.headers.get("CF-Connecting-IP") || null,
        userAgent: request.headers.get("User-Agent") || null,
      });
    } catch { /* non-fatal */ }

    return json({ success: true, topic_id, action });
  } catch (e) {
    console.error("topic-action error:", e);
    return json({ error: e.message }, 500);
  }
}
