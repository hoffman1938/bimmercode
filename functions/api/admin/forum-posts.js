// functions/api/admin/forum-posts.js
// GET /api/admin/forum-posts?q=&limit=&offset=
// Lists all forum posts (admin). Search matches post body, topic title, or topic opening body.
import { authenticateAdminRequest } from "../../lib/admin-gate.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build LIKE pattern; strip wildcard chars so the query is a literal word/phrase search. */
function likePattern(q) {
  const s = String(q || "")
    .trim()
    .replace(/[%_\\]/g, " ")
    .replace(/\s+/g, " ");
  if (!s) return null;
  return `%${s}%`;
}

export async function onRequestGet(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;

  const { request, env } = context;
  const url = new URL(request.url);
  const rawQ = url.searchParams.get("q");
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit"), 10) || 40, 1), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset"), 10) || 0, 0);
  const onlyDeleted = url.searchParams.get("only_deleted") === "1";

  const pat = likePattern(rawQ);

  const where = [];
  const countParams = [];
  const selectParams = [];

  if (onlyDeleted) {
    where.push("p.is_deleted = 1");
  }

  if (pat) {
    where.push("(p.content LIKE ? OR t.title LIKE ? OR t.content LIKE ?)");
    countParams.push(pat, pat, pat);
    selectParams.push(pat, pat, pat);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const countStmt = env.DB.prepare(
      `SELECT COUNT(*) AS c
         FROM posts p
         INNER JOIN topics t ON t.id = p.topic_id
         ${whereSql}`
    );
    const { c: total } = (await countStmt.bind(...countParams).first()) || { c: 0 };

    const selectBinding = [...selectParams, limit, offset];
    const { results: rows } = await env.DB.prepare(
      `SELECT
          p.id,
          p.topic_id,
          p.user_id,
          p.username,
          p.content,
          p.is_deleted,
          p.is_solution,
          p.created_at,
          t.title AS topic_title,
          t.category
        FROM posts p
        INNER JOIN topics t ON t.id = p.topic_id
        ${whereSql}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?`
    )
      .bind(...selectBinding)
      .all();

    const items = (rows || []).map((r) => {
      const text = (r.content || "").replace(/\s+/g, " ");
      return {
        ...r,
        content_preview: text.length > 220 ? text.slice(0, 220) + "…" : text,
      };
    });

    return json({
      success: true,
      posts: items,
      total: Number(total) || 0,
      limit,
      offset,
      q: rawQ && String(rawQ).trim() ? String(rawQ).trim() : "",
    });
  } catch (e) {
    console.error("admin forum-posts:", e);
    return json({ success: false, error: e.message || "query failed" }, 500);
  }
}
