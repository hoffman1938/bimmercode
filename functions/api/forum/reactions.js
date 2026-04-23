// functions/api/forum/reactions.js
// Emoji reactions on posts. Supports:
//   POST   { post_id, user_id, emoji }  -> toggle (idempotent)
//   GET    ?post_id=...                 -> list reactions aggregated by emoji
//   DELETE { post_id, user_id, emoji }  -> explicit remove

import { verifyToken } from "../../lib/jwt.js";
import { checkRateLimit, RATE_LIMITS, getIpAddress } from "../../lib/rate-limit.js";
import { insertNotificationIfAllowed } from "../../lib/forum-notifications.js";

const ALLOWED_EMOJI = ["👍", "❤️", "🔥", "🚗", "🔧", "😂", "😮", "🎉"];

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  return await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
}

/**
 * Opening post uses post_id = topic_id (shadow row in `posts`, see migrations/008).
 * If that row is missing, FK to posts + "Post not found" break reactions on the first post.
 * Heal by mirroring the topic into posts (INSERT OR IGNORE), same as 008.
 * @param {D1Database} db
 * @param {string} postId
 * @returns {Promise<{ user_id: string, topic_id: string } | null>}
 */
async function loadPostForReactionOrCreateShadow(db, postId) {
  if (!postId) return null;
  let post = await db
    .prepare("SELECT user_id, topic_id FROM posts WHERE id = ?")
    .bind(postId)
    .first();
  if (post) return post;

  const topic = await db
    .prepare(
      `SELECT id, user_id, username, content,
              COALESCE(NULLIF(lang, ''), 'en') AS lang,
              created_at, updated_at
         FROM topics WHERE id = ?`
    )
    .bind(postId)
    .first();
  if (!topic) return null;

  await db
    .prepare(
      `INSERT OR IGNORE INTO posts (id, topic_id, user_id, username, content, lang, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))`
    )
    .bind(
      topic.id,
      topic.id,
      topic.user_id,
      topic.username,
      topic.content,
      topic.lang,
      topic.created_at,
      topic.updated_at
    )
    .run();

  return await db
    .prepare("SELECT user_id, topic_id FROM posts WHERE id = ?")
    .bind(postId)
    .first();
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (request.method === "GET") {
    const url = new URL(request.url);
    const postId = url.searchParams.get("post_id");
    const userId = url.searchParams.get("user_id") || null;
    if (!postId) return json({ error: "post_id required" }, 400);

    try {
      const { results: agg } = await db
        .prepare(
          `SELECT emoji, COUNT(*) AS count
             FROM reactions
            WHERE post_id = ?
            GROUP BY emoji
            ORDER BY count DESC`
        )
        .bind(postId)
        .all();

      let mine = [];
      if (userId) {
        const { results } = await db
          .prepare(
            `SELECT emoji FROM reactions WHERE post_id = ? AND user_id = ?`
          )
          .bind(postId, userId)
          .all();
        mine = (results || []).map((r) => r.emoji);
      }
      return json({ reactions: agg || [], mine });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (request.method === "POST" || request.method === "DELETE") {
    const decoded = await requireAuth(request, env);
    if (!decoded) return json({ error: "Unauthorized" }, 401);

    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const { post_id, emoji } = data || {};
    const userId = decoded.id;

    if (!post_id || !emoji) return json({ error: "post_id and emoji required" }, 400);
    if (!ALLOWED_EMOJI.includes(emoji)) return json({ error: "Unsupported emoji" }, 400);

    // Rate limit reactions to avoid spamming
    const ip = getIpAddress(request);
    const rl = await checkRateLimit(env, userId, RATE_LIMITS.FORUM_REACTION);
    if (!rl.allowed) return json({ error: "Too many reactions. Slow down." }, 429);
    const rl2 = await checkRateLimit(env, `ip:${ip}`, RATE_LIMITS.FORUM_REACTION);
    if (!rl2.allowed) return json({ error: "Too many reactions from this IP." }, 429);

    try {
      const post = await loadPostForReactionOrCreateShadow(db, post_id);
      if (!post) return json({ error: "Post not found" }, 404);

      if (request.method === "DELETE") {
        await db
          .prepare("DELETE FROM reactions WHERE post_id = ? AND user_id = ? AND emoji = ?")
          .bind(post_id, userId, emoji)
          .run();
        return json({ success: true, action: "removed" });
      }

      // POST — toggle
      const existing = await db
        .prepare("SELECT id FROM reactions WHERE post_id = ? AND user_id = ? AND emoji = ?")
        .bind(post_id, userId, emoji)
        .first();

      if (existing) {
        await db.prepare("DELETE FROM reactions WHERE id = ?").bind(existing.id).run();
        return json({ success: true, action: "removed" });
      }

      await db
        .prepare("INSERT INTO reactions (id, post_id, user_id, emoji) VALUES (?, ?, ?, ?)")
        .bind(crypto.randomUUID(), post_id, userId, emoji)
        .run();

      if (post.user_id) {
        const sender = await db
          .prepare("SELECT username FROM users WHERE id = ?")
          .bind(userId)
          .first();
        const un = sender?.username || "Someone";
        const link = `/topic?id=${post.topic_id}#post-${post_id}`;
        await insertNotificationIfAllowed(db, {
          toUserId: post.user_id,
          fromUserId: userId,
          topicId: post.topic_id,
          type: "reaction",
          title: "Emoji reaction",
          text: `${un} reacted with ${emoji} to your post`,
          link,
          icon: "fa-smile",
          metadata: {
            sender_id: userId,
            post_id,
            topic_id: post.topic_id,
            emoji,
          },
        });
      }

      return json({ success: true, action: "added" });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
