/**
 * POST { type: "post"|"topic", id, user_id }
 * - "topic": remove thread (topic + posts + dependent rows).
 * - "post": remove a reply, OR if id is the opening post / shadow row missing,
 *   treat as whole-topic delete (same as opening the thread from the UI on id = topicId).
 */
import { deleteSinglePost, deleteTopicTree } from "../../lib/forum-delete.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { type, id, user_id } = await request.json();

    if (!id || !user_id) {
      return new Response(JSON.stringify({ error: "Missing id or user_id" }), { status: 400 });
    }

    const user = await db.prepare("SELECT role_id FROM users WHERE id = ?").bind(user_id).first();
    const isAdmin = user && (user.role_id === "admin_role" || user.role_id === "super_admin_role");

    if (type === "topic") {
      return await deleteTopicById(db, id, user_id, isAdmin);
    }

    if (type === "post") {
      const post = await db
        .prepare("SELECT id, user_id, topic_id FROM posts WHERE id = ?")
        .bind(id)
        .first();

      // No posts row: often the client sends topic id for the "opening" post but migration 008
      // (shadow id = topic_id) was never applied — delete the whole topic if the user may.
      if (!post) {
        const topic = await db.prepare("SELECT id, user_id FROM topics WHERE id = ?").bind(id).first();
        if (topic) {
          return await deleteTopicById(db, id, user_id, isAdmin);
        }
        return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 });
      }

      // Mirror row: opening post (posts.id = topic_id) — only whole-topic delete
      if (String(post.id) === String(post.topic_id)) {
        return await deleteTopicById(db, post.topic_id, user_id, isAdmin);
      }

      let mayDelete = !!isAdmin;
      if (!mayDelete) {
        if (String(post.user_id) === String(user_id)) {
          mayDelete = true;
        } else {
          const topic = await db
            .prepare("SELECT user_id FROM topics WHERE id = ?")
            .bind(post.topic_id)
            .first();
          if (topic && String(topic.user_id) === String(user_id)) {
            mayDelete = true;
          }
        }
      }

      if (!mayDelete) {
        return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
      }

      const result = await deleteSinglePost(db, id);
      if (result.meta.changes > 0) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
    }

    return new Response(JSON.stringify({ error: "Access denied or not found" }), { status: 403 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

/**
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {string} topicId
 */
async function deleteTopicById(db, topicId, userId, isAdmin) {
  if (!isAdmin) {
    const topic = await db.prepare("SELECT user_id FROM topics WHERE id = ?").bind(topicId).first();
    if (!topic || String(topic.user_id) !== String(userId)) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
    }
  }

  const topicExists = await db.prepare("SELECT 1 AS x FROM topics WHERE id = ?").bind(topicId).first();
  if (!topicExists) {
    return new Response(JSON.stringify({ error: "Topic not found" }), { status: 404 });
  }

  const result = await deleteTopicTree(db, topicId);

  if (result.meta.changes > 0) {
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
  return new Response(JSON.stringify({ error: "Could not delete topic" }), { status: 500 });
}
