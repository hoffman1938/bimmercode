import { authenticateAdminRequest } from "../../lib/admin-gate.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";
import { getIpAddress } from "../../lib/rate-limit.js";

/** POST move topic, POST merge (basic: append titles) */
export async function onRequestPost(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;
  const body = await request.json();
  const action = body.action || "move";

  if (action === "move") {
    const { topic_id, category_slug } = body;
    if (!topic_id || !category_slug) {
      return json({ error: "topic_id and category_slug required" }, 400);
    }
    await env.DB.prepare("UPDATE topics SET category = ? WHERE id = ?")
      .bind(category_slug, topic_id)
      .run();
    await logAudit(env, {
      userId: auth.userId,
      action: "topic_moved",
      targetEntityType: "topic",
      targetEntityId: topic_id,
      details: { category_slug },
      ipAddress: getIpAddress(request),
    });
    return json({ success: true });
  }

  if (action === "merge") {
    const { source_topic_id, target_topic_id } = body;
    if (!source_topic_id || !target_topic_id) {
      return json({ error: "source_topic_id and target_topic_id required" }, 400);
    }
    const src = await env.DB.prepare("SELECT title FROM topics WHERE id = ?")
      .bind(source_topic_id)
      .first();
    await env.DB.prepare("UPDATE posts SET topic_id = ? WHERE topic_id = ?")
      .bind(target_topic_id, source_topic_id)
      .run();
    await env.DB.prepare(
      "UPDATE topics SET title = title || ' [merged]' WHERE id = ?"
    )
      .bind(source_topic_id)
      .run();
    await env.DB.prepare("UPDATE topics SET is_archived = 1 WHERE id = ?")
      .bind(source_topic_id)
      .run();
    await logAudit(env, {
      userId: auth.userId,
      action: "topic_merged",
      targetEntityType: "topic",
      targetEntityId: target_topic_id,
      details: { from: source_topic_id, from_title: src?.title },
      ipAddress: getIpAddress(request),
    });
    return json({ success: true });
  }

  return json({ error: "Unknown action" }, 400);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
