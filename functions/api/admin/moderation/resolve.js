// functions/api/admin/moderation/resolve.js
// POST /api/admin/moderation/resolve
// Body: { report_id, action, note? }
//   action ∈ 'approve' (dismiss report, keep content)
//          | 'remove'  (delete the reported post/topic)
//          | 'lock'    (lock the topic)
//          | 'pin'     (pin the topic)
//          | 'unpin'   (unpin the topic)
//          | 'warn'    (issue warning to author — see /warn endpoint for rich version)
//
// Requires: admin or super_admin (see authenticateAdminRequest).

import { authenticateAdminRequest } from "../../../lib/admin-gate.js";
import { logAudit, AUDIT_ACTIONS } from "../../../lib/audit.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ACTIONS = ["approve", "remove", "lock", "unlock", "pin", "unpin", "warn"];

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const moderatorId = auth.userId;

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { report_id, action, note } = body || {};
  if (!report_id || !action) return json({ error: "report_id and action required" }, 400);
  if (!ACTIONS.includes(action)) return json({ error: `action must be one of ${ACTIONS.join(", ")}` }, 400);

  try {
    const report = await env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(report_id).first();
    if (!report) return json({ error: "Report not found" }, 404);

    // Existing schema uses reported_entity_type / reported_entity_id
    const entityType = report.reported_entity_type || report.entity_type;
    const entityId   = report.reported_entity_id   || report.entity_id;

    let targetTopicId = null;
    let targetPostId = null;
    let targetUserId = report.reported_user_id || null;
    if (entityType === "post") {
      targetPostId = entityId;
      const p = await env.DB.prepare("SELECT topic_id, user_id FROM posts WHERE id = ?").bind(entityId).first();
      if (p) { targetTopicId = p.topic_id; targetUserId = targetUserId || p.user_id; }
    } else if (entityType === "topic") {
      targetTopicId = entityId;
      const t = await env.DB.prepare("SELECT user_id FROM topics WHERE id = ?").bind(entityId).first();
      if (t) targetUserId = targetUserId || t.user_id;
    } else if (entityType === "user") {
      targetUserId = entityId;
    }

    // Execute action
    switch (action) {
      case "approve":
        break;
      case "remove":
        if (entityType === "post") {
          await env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(targetPostId).run();
        } else if (entityType === "topic") {
          await env.DB.prepare(`DELETE FROM posts WHERE topic_id = ?`).bind(targetTopicId).run();
          await env.DB.prepare(`DELETE FROM topics WHERE id = ?`).bind(targetTopicId).run();
        }
        break;
      case "lock":
        if (targetTopicId) await env.DB.prepare(`UPDATE topics SET is_locked = 1 WHERE id = ?`).bind(targetTopicId).run();
        break;
      case "unlock":
        if (targetTopicId) await env.DB.prepare(`UPDATE topics SET is_locked = 0 WHERE id = ?`).bind(targetTopicId).run();
        break;
      case "pin":
        if (targetTopicId) await env.DB.prepare(`UPDATE topics SET is_pinned = 1 WHERE id = ?`).bind(targetTopicId).run();
        break;
      case "unpin":
        if (targetTopicId) await env.DB.prepare(`UPDATE topics SET is_pinned = 0 WHERE id = ?`).bind(targetTopicId).run();
        break;
      case "warn":
        if (targetUserId) {
          await env.DB.prepare(
            `INSERT INTO warnings (id, user_id, moderator_id, reason, severity, is_active)
             VALUES (?, ?, ?, ?, ?, 1)`
          ).bind(
            crypto.randomUUID(),
            targetUserId,
            moderatorId,
            note || report.reason,
            "minor",
          ).run();
        }
        break;
    }

    // Mark report using existing schema columns
    const resolution = action === "approve" ? "dismissed" : "resolved";
    await env.DB.prepare(`
      UPDATE reports
         SET status = ?, resolution_notes = ?, moderator_id = ?, resolved_at = CURRENT_TIMESTAMP
       WHERE id = ?
    `).bind(resolution, note ? String(note).slice(0, 1000) : action, moderatorId, report_id).run();

    // Audit log — map the action to a richer constant when possible.
    const auditAction =
      action === "remove"  ? AUDIT_ACTIONS.POST_DELETED :
      action === "lock"    ? AUDIT_ACTIONS.TOPIC_LOCKED :
      action === "unlock"  ? AUDIT_ACTIONS.TOPIC_UNLOCKED :
      action === "pin"     ? AUDIT_ACTIONS.TOPIC_PINNED :
      action === "unpin"   ? AUDIT_ACTIONS.TOPIC_UNPINNED :
      action === "warn"    ? AUDIT_ACTIONS.WARNING_ISSUED :
                             AUDIT_ACTIONS.REPORT_RESOLVED;

    try {
      await logAudit(env, {
        userId: moderatorId,
        action: auditAction,
        targetEntityType: entityType,
        targetEntityId: entityId,
        targetUserId,
        details: { report_id, action, note: note || null },
        ipAddress: request.headers.get("CF-Connecting-IP") || null,
        userAgent: request.headers.get("User-Agent") || null,
      });
    } catch { /* non-fatal */ }

    return json({ success: true, action, report_id, status: resolution });
  } catch (e) {
    console.error("resolve error:", e);
    return json({ error: e.message }, 500);
  }
}
