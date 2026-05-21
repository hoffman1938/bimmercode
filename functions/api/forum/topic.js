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
import { insertNotificationIfAllowed } from "../../lib/forum-notifications.js";
import { getViewerIdFromRequest, getBlockedUserIdsForBlocker } from "../../lib/user-blocks.js";
import { ensureFtsSyncTriggersDropped, withFtsBypass } from "../../lib/fts-bypass.js";
import {
  getUserRestrictions,
  restrictionError,
  stripLinksIfNeeded,
} from "../../lib/user-restrictions.js";

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
                COALESCE(u.username, t.username) AS username,
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

    const viewerId = await getViewerIdFromRequest(request, env);
    const blockedIds = viewerId ? await getBlockedUserIdsForBlocker(db, viewerId) : [];
    const blockedSet = new Set(blockedIds.map(String));
    if (topic.user_id && blockedSet.has(String(topic.user_id))) {
      return json(
        { error: "You have blocked this user. The topic is hidden for you.", code: "author_blocked" },
        403
      );
    }

    const postsSqlWithPin = `
        SELECT
            p.*,
            COALESCE(u.username, p.username) AS username,
            u.avatar_url   AS author_avatar,
            u.role_id      AS author_role,
            u.reputation   AS author_reputation,
            COALESCE(ru.username, rp.username) AS reply_to_username,
            SUBSTR(COALESCE(rp.content, ''), 1, 360) AS reply_to_excerpt
           FROM posts p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN posts rp ON rp.id = p.reply_to_post_id
      LEFT JOIN users ru ON ru.id = rp.user_id
          WHERE p.topic_id = ? AND p.id != p.topic_id
          ORDER BY COALESCE(p.is_pinned, 0) DESC, p.created_at ASC`;

    const postsSqlLegacy = postsSqlWithPin.replace(
      "ORDER BY COALESCE(p.is_pinned, 0) DESC, p.created_at ASC",
      "ORDER BY p.created_at ASC"
    );

    let posts;
    try {
      ({ results: posts } = await db.prepare(postsSqlWithPin).bind(topicId).all());
    } catch (pinErr) {
      if (!String(pinErr?.message || "").includes("is_pinned")) throw pinErr;
      ({ results: posts } = await db.prepare(postsSqlLegacy).bind(topicId).all());
    }

    const cleanPosts = (posts || []).map((p) => {
      if (p.user_id && blockedSet.has(String(p.user_id))) {
        return {
          id: p.id,
          topic_id: p.topic_id,
          user_id: p.user_id,
          created_at: p.created_at?.endsWith("Z") ? p.created_at : (p.created_at || "") + "Z",
          is_hidden: true,
          username: "—",
          content: "",
          author_avatar: null,
          author_reputation: 0,
          author_role: null,
          is_solution: 0,
          reply_to_post_id: null,
          reply_to_username: null,
          reply_to_excerpt: null,
        };
      }
      return {
        ...p,
        created_at: p.created_at?.endsWith("Z") ? p.created_at : (p.created_at || "") + "Z",
        is_hidden: false,
      };
    });

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

      const { results: nameRows } = await db
        .prepare(
          `SELECT r.post_id, r.emoji, COALESCE(u.username, '?') AS username
             FROM reactions r
             LEFT JOIN users u ON u.id = r.user_id
            WHERE r.post_id IN (${placeholders})
            ORDER BY r.post_id, r.emoji, LOWER(COALESCE(u.username, ''))`
        )
        .bind(...postIds)
        .all();

      const usersByKey = {};
      for (const row of nameRows || []) {
        const key = row.post_id + "\x1e" + row.emoji;
        (usersByKey[key] ||= []).push(row.username);
      }

      const byPost = {};
      for (const r of aggRows || []) {
        const key = r.post_id + "\x1e" + r.emoji;
        (byPost[r.post_id] ||= []).push({
          emoji: r.emoji,
          count: Number(r.count) || 0,
          users: usersByKey[key] || [],
        });
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
        if (p.is_hidden) {
          p.reactions = [];
          p.my_reactions = [];
        } else {
          p.reactions = byPost[p.id] || [];
          p.my_reactions = mineByPost[p.id] || [];
        }
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

    // Count one view per explicit client navigation — not on every refetch (reactions, edits, etc.)
    const shouldBumpViews = url.searchParams.get("count_view") === "1";
    if (shouldBumpViews) {
      context.waitUntil(
        db.prepare("UPDATE topics SET views = COALESCE(views,0) + 1 WHERE id = ?")
          .bind(topicId)
          .run()
      );
    }

    return json({ topic, posts: cleanPosts });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handlePost(context) {
  const { request, env } = context;
  const db = env.DB;
  /** Background work after reply insert: does not add to TTFB. */
  const scheduleAfterReply = (p) => {
    const job = Promise.resolve(p).catch((e) => {
      console.error("forum reply follow-up:", e?.message || e);
    });
    if (typeof context?.waitUntil === "function") {
      context.waitUntil(job);
    }
  };

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

    // --- 2. Rate limit (parallel — two round-trips in one) -----------------
    const ip = getIpAddress(request);
    const [rl1, rl2] = await Promise.all([
      checkRateLimit(env, userId, RATE_LIMITS.FORUM_REPLY),
      checkRateLimit(env, `ip:${ip}`, RATE_LIMITS.FORUM_REPLY),
    ]);
    if (!rl1.allowed) {
      return json({ error: "Too many replies. Slow down." }, 429);
    }
    if (!rl2.allowed) {
      return json({ error: "Too many replies from this IP." }, 429);
    }

    const flags = await getUserRestrictions(db, userId);
    const restrErr = restrictionError(flags, "reply");
    if (restrErr) return json({ error: restrErr }, 403);

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

    const content = stripLinksIfNeeded(String(data.content).trim(), flags);
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

    // Moderation: stopword filter only (no Workers LLM) — full AI for forum replies was adding seconds to TTFB.
    let moderation = { decision: "approve" };
    try {
      const mod = await import("../../lib/moderation.js").catch(() => null);
      if (mod && mod.moderateText) {
        moderation = await mod.moderateText(env, content, {
          entityType: "post",
          userId,
          skipAi: true,
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

    let replyToPostId = null;
    if (data.reply_to_post_id != null && String(data.reply_to_post_id).trim()) {
      const rid = String(data.reply_to_post_id).trim();
      const parent = await db
        .prepare("SELECT id, topic_id FROM posts WHERE id = ?")
        .bind(rid)
        .first();
      if (!parent || String(parent.topic_id) !== String(data.topic_id)) {
        return json({ error: "Invalid reply_to_post_id (not in this topic)" }, 400);
      }
      replyToPostId = rid;
    }

    const postId = crypto.randomUUID();

    await ensureFtsSyncTriggersDropped(db);
    await withFtsBypass(db, async () => {
      await db
        .prepare(
          `INSERT INTO posts (id, topic_id, user_id, username, content, lang, reply_to_post_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          postId,
          data.topic_id,
          userId,
          username,
          content,
          data.lang || "en",
          replyToPostId
        )
        .run();
    });

    // Notify in background: does not block the JSON response (was serial await per participant + mute check).
    const participants = new Set();
    if (topic.user_id) participants.add(String(topic.user_id));
    const { results: pRows } = await db
      .prepare(`SELECT DISTINCT user_id FROM posts WHERE topic_id = ?`)
      .bind(data.topic_id)
      .all();
    for (const r of pRows || []) {
      if (r?.user_id) participants.add(String(r.user_id));
    }
    participants.delete(String(userId));

    const topicId = data.topic_id;
    const fromUid = String(userId);
    const fromName = username || "Someone";
    scheduleAfterReply(
      Promise.all(
        [...participants].map((toUid) =>
          insertNotificationIfAllowed(db, {
            toUserId: toUid,
            fromUserId: userId,
            topicId,
            type: "reply",
            title: "New activity in a topic you follow",
            text: fromName + " posted a new reply",
            link: `/topic?id=${topicId}#post-${postId}`,
            icon: "fa-reply",
            metadata: {
              sender_id: fromUid,
              sender_name: fromName,
              topic_id: topicId,
              post_id: postId,
            },
          })
        )
      )
    );

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
