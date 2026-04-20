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
// Requires: permission 'moderate_content'.

import { verifyToken } from "../../../lib/jwt.js";
import { requirePermission } from "../../../lib/permissions.js";
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

  const { report_id, action, note } = body || {};
  if (!report_id || !action) return json({ error: "report_id and action required" }, 400);
  if (!ACTIONS.includes(action)) return json({ error: `action must be one of ${ACTIONS.join(", ")}` }, 400);

  try {
    const report = await env.DB.prepare("SELECT * FROM reports WHERE id = ?").bind(report_id).first();
    if (!report) return json({ error: "Report not found" }, 404);

    // Resolve target
    let targetTopicId = null;
    let targetPostId = null;
    let targetUserId = null;
    if (report.entity_type === "post") {
      targetPostId = report.entity_id;
      const p = await env.DB.prepare("SELECT topic_id, user_id FROM posts WHERE id = ?").bind(report.entity_id).first();
      if (p) { targetTopicId = p.topic_id; targetUserId = p.user_id; }
    } else if (report.entity_type === "topic") {
      targetTopicId = report.entity_id;
      const t = await env.DB.prepare("SELECT user_id FROM topics WHERE id = ?").bind(report.entity_id).first();
      if (t) targetUserId = t.user_id;
    } else if (report.entity_type === "user") {
      targetUserId = report.entity_id;
    }

    // Execute action
    switch (action) {
      case "approve":
        // Dismiss report, keep content
        break;
      case "remove":
        if (report.entity_type === "post") {
          await env.DB.prepare(`DELETE FROM posts WHERE id = ?`).bind(targetPostId).run();
        } else if (report.entity_type === "topic") {
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
            `INSERT INTO user_warnings (id, user_id, issued_by, reason, severity, related_post_id, related_topic_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            crypto.randomUUID(),
            targetUserId,
            payload.id,
            note || report.reason,
            "medium",
            targetPostId,
            targetTopicId,
          ).run();
        }
        break;
    }

    // Mark report as resolved
    const resolution = action === "approve" ? "dismissed" : "resolved";
    await env.DB.prepare(`
      UPDATE reports
         SET status = ?, resolution = ?, handled_by = ?, handled_at = CURRENT_TIMESTAMP
       WHERE id = ?
    `).bind(resolution, action, payload.id, report_id).run();

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
        userId: payload.id,
        action: auditAction,
        targetEntityType: report.entity_type,
        targetEntityId: report.entity_id,
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
