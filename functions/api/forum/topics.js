// functions/api/forum/topics.js
// List + create forum topics with:
//   - FTS5-powered search (fallback to LIKE on migration mismatch)
//   - Cursor-based pagination (stable ordering)
//   - Sort: newest | popular | most_viewed | recently_active
//   - Filters: category, tab (all|unanswered|solved|pinned), lang, tag, user_id
//   - Denormalized: reply_count, last_reply_at, author avatar/reputation
//
// Security on POST (new topic):
//   - Auth (Bearer JWT) required
//   - Rate-limit by user_id + IP (FORUM_NEW_TOPIC)
//   - Optional Turnstile verification via `cf-turnstile-response`

import { verifyToken } from "../../lib/jwt.js";
import { checkRateLimit, RATE_LIMITS, getIpAddress } from "../../lib/rate-limit.js";
import { verifyTurnstile } from "../../lib/turnstile.js";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Very conservative FTS5 query sanitization: tokenize on whitespace,
// strip non-alphanumeric+cyrillic+georgian chars, wrap each token as prefix match.
function buildFtsQuery(raw) {
  if (!raw) return null;
  const tokens = raw
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t}"*`).join(" AND ");
}

async function handleGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  const category = url.searchParams.get("category") || "all";
  const search = (url.searchParams.get("search") || "").trim();
  const tab = url.searchParams.get("tab") || "all"; // all|unanswered|solved|pinned
  const sort = url.searchParams.get("sort") || "newest"; // newest|popular|most_viewed|recently_active
  const lang = url.searchParams.get("lang");
  const tag = url.searchParams.get("tag");
  const userId = url.searchParams.get("user_id");
  const cursor = url.searchParams.get("cursor"); // base64 JSON { key, id }

  let limit = parseInt(url.searchParams.get("limit") || String(PAGE_SIZE_DEFAULT), 10);
  if (!Number.isFinite(limit) || limit < 1) limit = PAGE_SIZE_DEFAULT;
  if (limit > PAGE_SIZE_MAX) limit = PAGE_SIZE_MAX;

  const conditions = [];
  const params = [];

  if (category && category !== "all") {
    conditions.push("t.category = ?");
    params.push(category);
  }
  if (lang && ["en", "ru", "ka"].includes(lang)) {
    conditions.push("t.lang = ?");
    params.push(lang);
  }
  if (userId) {
    conditions.push("t.user_id = ?");
    params.push(userId);
  }
  if (tab === "unanswered") {
    conditions.push("COALESCE(t.reply_count, 0) = 0");
  } else if (tab === "solved") {
    conditions.push("t.is_solved = 1");
  } else if (tab === "pinned") {
    conditions.push("t.is_pinned = 1");
  }
  // Tag filter via subquery on topic_tags
  if (tag) {
    conditions.push(
      "t.id IN (SELECT tt.topic_id FROM topic_tags tt JOIN tags tg ON tg.id = tt.tag_id WHERE tg.name = ?)"
    );
    params.push(tag);
  }

  // Exclude archived by default
  conditions.push("(t.is_archived IS NULL OR t.is_archived = 0)");

  // Search: try FTS5 first, fallback to LIKE
  let searchJoin = "";
  if (search) {
    const ftsQuery = buildFtsQuery(search);
    if (ftsQuery) {
      try {
        // quick probe to detect FTS5 table existence
        await db.prepare("SELECT 1 FROM topics_fts LIMIT 1").first();
        searchJoin = " JOIN topics_fts fts ON fts.rowid = t.rowid ";
        conditions.push("topics_fts MATCH ?");
        params.push(ftsQuery);
      } catch {
        conditions.push("(t.title LIKE ? OR t.content LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
      }
    } else {
      conditions.push("(t.title LIKE ? OR t.content LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
  }

  // Sorting — decide sort column + direction. We always keyset-paginate by (sortKey, id).
  let sortExpr, sortColumn;
  switch (sort) {
    case "popular":
      sortExpr = "COALESCE(t.reply_count, 0) DESC, t.id DESC";
      sortColumn = "COALESCE(t.reply_count, 0)";
      break;
    case "most_viewed":
      sortExpr = "COALESCE(t.views, 0) DESC, t.id DESC";
      sortColumn = "COALESCE(t.views, 0)";
      break;
    case "recently_active":
      sortExpr = "COALESCE(t.last_reply_at, t.created_at) DESC, t.id DESC";
      sortColumn = "COALESCE(t.last_reply_at, t.created_at)";
      break;
    case "newest":
    default:
      sortExpr = "t.created_at DESC, t.id DESC";
      sortColumn = "t.created_at";
      break;
  }

  // Pinned topics first when sorting by recent/newest and no search
  const pinnedFirst = !search && (sort === "newest" || sort === "recently_active");
  const effectiveSort = pinnedFirst ? `t.is_pinned DESC, ${sortExpr}` : sortExpr;

  // Cursor decode (cursor = { k, id } where k = sort key value)
  if (cursor) {
    try {
      const decoded = JSON.parse(atob(cursor));
      if (decoded && decoded.k !== undefined && decoded.id) {
        conditions.push(`(${sortColumn} < ? OR (${sortColumn} = ? AND t.id < ?))`);
        params.push(decoded.k, decoded.k, decoded.id);
      }
    } catch {
      /* ignore malformed cursor */
    }
  }

  const whereClause = conditions.length
    ? " WHERE " + conditions.join(" AND ")
    : "";

  const query = `
    SELECT
      t.id, t.user_id, t.username, t.category, t.title, t.content, t.related_code,
      t.lang, t.views, t.is_solved, t.is_pinned, t.is_locked, t.is_archived,
      t.created_at, t.updated_at,
      COALESCE(t.reply_count, 0)      AS reply_count,
      t.last_reply_at, t.last_reply_user_id, t.last_reply_username,
      u.avatar_url   AS author_avatar,
      u.role_id      AS author_role,
      u.reputation   AS author_reputation
    FROM topics t ${searchJoin}
    LEFT JOIN users u ON u.id = t.user_id
    ${whereClause}
    ORDER BY ${effectiveSort}
    LIMIT ?
  `;

  try {
    const stmt = db.prepare(query).bind(...params, limit + 1);
    const { results } = await stmt.all();

    const hasMore = results.length > limit;
    const topics = hasMore ? results.slice(0, limit) : results;

    let nextCursor = null;
    if (hasMore && topics.length) {
      const last = topics[topics.length - 1];
      let k;
      switch (sort) {
        case "popular":          k = last.reply_count || 0; break;
        case "most_viewed":      k = last.views || 0; break;
        case "recently_active":  k = last.last_reply_at || last.created_at; break;
        default:                 k = last.created_at;
      }
      nextCursor = btoa(JSON.stringify({ k, id: last.id }));
    }

    // Preview tags per topic (top 3) — batch query
    if (topics.length) {
      const placeholders = topics.map(() => "?").join(",");
      const tagsRows = await db
        .prepare(
          `SELECT tt.topic_id, tg.name, tg.color
             FROM topic_tags tt JOIN tags tg ON tg.id = tt.tag_id
            WHERE tt.topic_id IN (${placeholders})`
        )
        .bind(...topics.map((t) => t.id))
        .all();
      const byTopic = {};
      for (const row of tagsRows.results || []) {
        (byTopic[row.topic_id] ||= []).push({ name: row.name, color: row.color });
      }
      for (const t of topics) t.tags = byTopic[t.id] || [];
    }

    return jsonResponse({
      topics,
      nextCursor,
      hasMore,
      sort,
      tab,
      category,
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
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
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const data = await request.json();
    if (!data.title || !data.content) {
      return jsonResponse({ error: "Missing fields" }, 400);
    }

    // Force author from token — don't trust client-supplied user_id
    const userId = payload.id;
    const username = payload.username || data.username || "user";

    // --- 2. Rate limit -----------------------------------------------
    const ip = getIpAddress(request);
    const rl1 = await checkRateLimit(env, userId, RATE_LIMITS.FORUM_NEW_TOPIC);
    if (!rl1.allowed) {
      return jsonResponse(
        { error: "Too many new topics. Please wait.", resetAt: rl1.resetAt.toISOString() },
        429
      );
    }
    const rl2 = await checkRateLimit(env, `ip:${ip}`, RATE_LIMITS.FORUM_NEW_TOPIC);
    if (!rl2.allowed) {
      return jsonResponse({ error: "Too many new topics from this IP." }, 429);
    }

    // --- 3. Turnstile (optional) -------------------------------------
    if (data.turnstile_token || request.headers.get("cf-turnstile-response")) {
      const ts = await verifyTurnstile(
        env,
        data.turnstile_token || request.headers.get("cf-turnstile-response"),
        request
      );
      if (!ts.ok) {
        return jsonResponse({ error: "Captcha failed", reason: ts.reason }, 403);
      }
    }

    const title = String(data.title).trim();
    const content = String(data.content).trim();

    if (title.length < 8 || title.length > 160) {
      return jsonResponse({ error: "Title must be 8–160 characters" }, 400);
    }
    if (content.length < 20 || content.length > 8000) {
      return jsonResponse({ error: "Content must be 20–8000 characters" }, 400);
    }

    // Moderation hook (AI + stopword filter). Non-blocking stub by default.
    let moderation = { decision: "approve", severity: "low", flags: [] };
    try {
      const mod = await import("../../lib/moderation.js").catch(() => null);
      if (mod && mod.moderateText) {
        moderation = await mod.moderateText(env, `${title}\n\n${content}`, {
          entityType: "topic",
          userId,
        });
      }
    } catch {
      /* fail open */
    }
    if (moderation.decision === "block") {
      return jsonResponse(
        {
          error: "Content rejected by moderation",
          reason: moderation.explanation || "Violates community guidelines",
          flags: moderation.flags || [],
        },
        422
      );
    }

    const topicId = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO topics
          (id, user_id, username, category, title, content, related_code, lang)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        topicId,
        userId,
        username,
        data.category || "off-topic",
        title,
        content,
        data.related_code || null,
        data.lang || "en"
      )
      .run();

    // Attach tags (comma-separated)
    if (Array.isArray(data.tags) || typeof data.tags === "string") {
      const tagList = (Array.isArray(data.tags) ? data.tags : String(data.tags).split(","))
        .map((t) => String(t).trim().toLowerCase())
        .filter((t) => /^[a-z0-9\-]{2,24}$/.test(t))
        .slice(0, 5);
      for (const name of tagList) {
        // Upsert tag
        let tag = await db.prepare("SELECT id FROM tags WHERE name = ?").bind(name).first();
        if (!tag) {
          const id = crypto.randomUUID();
          await db
            .prepare("INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)")
            .bind(id, name)
            .run();
          tag = { id };
        }
        await db
          .prepare("INSERT OR IGNORE INTO topic_tags (topic_id, tag_id) VALUES (?, ?)")
          .bind(topicId, tag.id)
          .run();
      }
    }

    return jsonResponse({ success: true, topicId, moderation: { decision: moderation.decision } }, 201);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "GET") return handleGet(context);
  if (request.method === "POST") return handlePost(context);
  return new Response("Method not allowed", { status: 405 });
}
