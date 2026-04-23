// functions/api/forum/topic.js
// Single topic view + reply creation.
//
// Security on POST (new reply):
//   - Auth (Bearer JWT) required
//   - Rate-limit by user + IP (FORUM_REPLY)
//   - Optional Turnstile verification

import { verifyToken } from "../../lib/jwt.js";
import { checkRateLimit, RATE_LIMITS, getIpAddress } from "../../lib/rate-limit.js";
import { verifyTurnstile } from "../../lib/turnstile.js";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  const topicId = url.searchParams.get("id");
  const currentUserId = url.searchParams.get("user_id") || null;
  if (!topicId) return json({ error: "ID required" }, 400);

  try {
    const topic = await db
      .prepare(
        `SELECT t.*,
                u.avatar_url   AS author_avatar,
                u.role_id      AS author_role,
                u.reputation   AS author_reputation
           FROM topics t
      LEFT JOIN users u ON u.id = t.user_id
          WHERE t.id = ?`
      )
      .bind(topicId)
      .first();

    if (!topic) return json({ error: "Not found" }, 404);

    const { results: posts } = await db
      .prepare(
        `SELECT
            p.*,
            u.avatar_url   AS author_avatar,
            u.role_id      AS author_role,
            u.reputation   AS author_reputation
           FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
          WHERE p.topic_id = ? AND p.id != p.topic_id
          ORDER BY p.created_at ASC`
      )
      .bind(topicId)
      .all();

    const cleanPosts = (posts || []).map((p) => ({
      ...p,
      created_at: p.created_at?.endsWith("Z") ? p.created_at : (p.created_at || "") + "Z",
    }));

    // Reactions: include opening-body mirror post (posts.id = topics.id) + replies
    const postIds = [topicId, ...cleanPosts.map((p) => p.id)];
    if (postIds.length) {
      const placeholders = postIds.map(() => "?").join(",");
      const { results: aggRows } = await db
        .prepare(
          `SELECT post_id, emoji, COUNT(*) AS count
             FROM reactions
            WHERE post_id IN (${placeholders})
            GROUP BY post_id, emoji`
        )
        .bind(...postIds)
        .all();

      const byPost = {};
      for (const r of aggRows || []) {
        (byPost[r.post_id] ||= []).push({ emoji: r.emoji, count: r.count });
      }

      let mineByPost = {};
      if (currentUserId) {
        const { results: mineRows } = await db
          .prepare(
            `SELECT post_id, emoji FROM reactions
              WHERE user_id = ? AND post_id IN (${placeholders})`
          )
          .bind(currentUserId, ...postIds)
          .all();
        for (const r of mineRows || []) {
          (mineByPost[r.post_id] ||= []).push(r.emoji);
        }
      }

      for (const p of cleanPosts) {
        p.reactions = byPost[p.id] || [];
        p.my_reactions = mineByPost[p.id] || [];
      }
      topic.reactions = byPost[topicId] || [];
      topic.my_reactions = mineByPost[topicId] || [];
    }

    // Tags for the topic
    const { results: tags } = await db
      .prepare(
        `SELECT tg.id, tg.name, tg.color
           FROM topic_tags tt JOIN tags tg ON tg.id = tt.tag_id
          WHERE tt.topic_id = ?`
      )
      .bind(topicId)
      .all();
    topic.tags = tags || [];

    // Async: increment views (don't block response)
    context.waitUntil(
      db.prepare("UPDATE topics SET views = COALESCE(views,0) + 1 WHERE id = ?")
        .bind(topicId)
        .run()
    );

    return json({ topic, posts: cleanPosts });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handlePost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    // --- 1. Auth -----------------------------------------------------
    const auth = request.headers.get("Authorization") || "";
    const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    const secret = env.JWT_SECRET || "secret-dev-key";
    const payload = jwt ? await verifyToken(jwt, secret) : null;
    if (!payload?.id) {
      return json({ error: "Authentication required" }, 401);
    }

    const data = await request.json();
    if (!data.topic_id || !data.content) {
      return json({ error: "Missing fields" }, 400);
    }
    const userId = payload.id;
    const username = payload.username || data.username || "user";

    // --- 2. Rate limit ----------------------------------------------
    const ip = getIpAddress(request);
    const rl1 = await checkRateLimit(env, userId, RATE_LIMITS.FORUM_REPLY);
    if (!rl1.allowed) {
      return json({ error: "Too many replies. Slow down." }, 429);
    }
    const rl2 = await checkRateLimit(env, `ip:${ip}`, RATE_LIMITS.FORUM_REPLY);
    if (!rl2.allowed) {
      return json({ error: "Too many replies from this IP." }, 429);
    }

    // --- 3. Turnstile (optional) -------------------------------------
    if (data.turnstile_token || request.headers.get("cf-turnstile-response")) {
      const ts = await verifyTurnstile(
        env,
        data.turnstile_token || request.headers.get("cf-turnstile-response"),
        request
      );
      if (!ts.ok) {
        return json({ error: "Captcha failed", reason: ts.reason }, 403);
      }
    }

    const content = String(data.content).trim();
    if (content.length < 2 || content.length > 8000) {
      return json({ error: "Content length invalid" }, 400);
    }

    // Check topic is not locked/archived
    const topic = await db
      .prepare("SELECT user_id, title, is_locked, is_archived FROM topics WHERE id = ?")
      .bind(data.topic_id)
      .first();
    if (!topic) return json({ error: "Topic not found" }, 404);
    if (topic.is_locked) return json({ error: "Topic is locked" }, 423);
    if (topic.is_archived) return json({ error: "Topic is archived" }, 423);

    // Moderation hook
    let moderation = { decision: "approve" };
    try {
      const mod = await import("../../lib/moderation.js").catch(() => null);
      if (mod && mod.moderateText) {
        moderation = await mod.moderateText(env, content, {
          entityType: "post",
          userId,
        });
      }
    } catch { /* fail open */ }
    if (moderation.decision === "block") {
      return json({
        error: "Content rejected",
        reason: moderation.explanation || "Violates community guidelines",
        flags: moderation.flags || [],
      }, 422);
    }

    const postId = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO posts (id, topic_id, user_id, username, content, lang)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        postId,
        data.topic_id,
        userId,
        username,
        content,
        data.lang || "en"
      )
      .run();

    // Notify OP of new reply
    if (topic.user_id && String(topic.user_id) !== String(userId)) {
      try {
        const metadata = JSON.stringify({
          sender_id: userId,
          sender_name: username,
          topic_id: data.topic_id,
          post_id: postId,
        });
        await db
          .prepare(
            `INSERT INTO notifications (id, user_id, type, title, text, link, icon, metadata)
             VALUES (?, ?, 'reply', ?, ?, ?, 'fa-reply', ?)`
          )
          .bind(
            crypto.randomUUID(),
            topic.user_id,
            "New reply in " + topic.title,
            (username || "Someone") + " replied to your topic",
            `/topic?id=${data.topic_id}#post-${postId}`,
            metadata
          )
          .run();
      } catch { /* schema variance fallback */ }
    }

    return json({ success: true, postId }, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === "GET")  return handleGet(context);
  if (context.request.method === "POST") return handlePost(context);
  return new Response("Method not allowed", { status: 405 });
}
