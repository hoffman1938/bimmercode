// functions/api/forum/reactions.js
// Emoji reactions on posts. Supports:
//   POST   { post_id, user_id, emoji }  -> toggle (idempotent)
//   GET    ?post_id=...                 -> list reactions aggregated by emoji
//   DELETE { post_id, user_id, emoji }  -> explicit remove

import { verifyToken } from "../../lib/jwt.js";
import { checkRateLimit, RATE_LIMITS, getIpAddress } from "../../lib/rate-limit.js";

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
      const post = await db.prepare("SELECT user_id FROM posts WHERE id = ?").bind(post_id).first();
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

      // Notification (first reaction per emoji by this user → notify post author)
      if (post.user_id && post.user_id !== userId) {
        try {
          await db
            .prepare(
              `INSERT INTO notifications (id, user_id, sender_id, type, topic_id, is_read)
               VALUES (?, ?, ?, 'reaction', (SELECT topic_id FROM posts WHERE id = ?), 0)`
            )
            .bind(crypto.randomUUID(), post.user_id, userId, post_id)
            .run();
        } catch {
          /* notifications table may differ on some installs */
        }
      }

      return json({ success: true, action: "added" });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
