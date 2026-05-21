/**
 * POST /api/forum/pin
 * Body: { type: "topic"|"post", id, pin: boolean }
 * Staff only: super_admin, admin, senior_moderator, moderator.
 */
import { authenticateStaffRequest } from "../../lib/staff-gate.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";
import { getIpAddress } from "../../lib/rate-limit.js";
import { ensureFtsSyncTriggersDropped } from "../../lib/fts-bypass.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await authenticateStaffRequest(context);
  if (!auth.ok) return auth.response;

  try {
    const { type, id, pin } = await request.json();
    if (!id || !type) return json({ error: "type and id required" }, 400);
    if (typeof pin !== "boolean") return json({ error: "pin must be true or false" }, 400);

    const db = env.DB;
    const ipAddress = getIpAddress(request);
    const pinVal = pin ? 1 : 0;

    await ensureFtsSyncTriggersDropped(db);

    if (type === "topic") {
      const topic = await db.prepare("SELECT id, user_id FROM topics WHERE id = ?").bind(id).first();
      if (!topic) return json({ error: "Topic not found" }, 404);

      await db.prepare("UPDATE topics SET is_pinned = ? WHERE id = ?").bind(pinVal, id).run();

      await logAudit(env, {
        userId: auth.userId,
        action: pin ? AUDIT_ACTIONS.TOPIC_PINNED : AUDIT_ACTIONS.TOPIC_UNPINNED,
        targetEntityType: "topic",
        targetEntityId: id,
        targetUserId: topic.user_id,
        details: { pin },
        ipAddress,
        userAgent: request.headers.get("User-Agent"),
      });

      return json({ success: true, type: "topic", id, is_pinned: pin });
    }

    if (type === "post") {
      const post = await db
        .prepare("SELECT id, topic_id, user_id FROM posts WHERE id = ?")
        .bind(id)
        .first();
      if (!post) return json({ error: "Post not found" }, 404);

      // Opening-body mirror row (id = topic_id) → pin the whole topic
      if (String(post.id) === String(post.topic_id)) {
        await db
          .prepare("UPDATE topics SET is_pinned = ? WHERE id = ?")
          .bind(pinVal, post.topic_id)
          .run();

        await logAudit(env, {
          userId: auth.userId,
          action: pin ? AUDIT_ACTIONS.TOPIC_PINNED : AUDIT_ACTIONS.TOPIC_UNPINNED,
          targetEntityType: "topic",
          targetEntityId: post.topic_id,
          targetUserId: post.user_id,
          details: { pin, via: "opening_post" },
          ipAddress,
          userAgent: request.headers.get("User-Agent"),
        });

        return json({ success: true, type: "topic", id: post.topic_id, is_pinned: pin });
      }

      try {
        await db.prepare("UPDATE posts SET is_pinned = ? WHERE id = ?").bind(pinVal, id).run();
      } catch (e) {
        if (String(e?.message || "").includes("is_pinned")) {
          return json({ error: "Post pinning not available (run migration 019)" }, 503);
        }
        throw e;
      }

      await logAudit(env, {
        userId: auth.userId,
        action: pin ? AUDIT_ACTIONS.POST_PINNED : AUDIT_ACTIONS.POST_UNPINNED,
        targetEntityType: "post",
        targetEntityId: id,
        targetUserId: post.user_id,
        details: { pin, topic_id: post.topic_id },
        ipAddress,
        userAgent: request.headers.get("User-Agent"),
      });

      return json({ success: true, type: "post", id, is_pinned: pin });
    }

    return json({ error: "type must be topic or post" }, 400);
  } catch (e) {
    console.error("forum pin:", e);
    return json({ error: e.message || "Pin failed" }, 500);
  }
}
