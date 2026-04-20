// functions/api/admin/moderation/queue.js
// GET /api/admin/moderation/queue?tab=reports|ai_flagged&status=open&limit=50
// Returns the moderation queue:
//   - reports: user-submitted reports + snippets of the reported content
//   - ai_flagged: moderation_decisions rows with decision='review' or 'block'

import { verifyToken } from "../../../lib/jwt.js";
import { requirePermission } from "../../../lib/permissions.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const secret = env.JWT_SECRET || "secret-dev-key";
  const payload = token ? await verifyToken(token, secret) : null;
  if (!payload?.id) return json({ error: "Unauthorized" }, 401);

  const err = await requirePermission("moderate_content")(context, payload.id);
  if (err) return err;

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "reports";
  const status = url.searchParams.get("status") || "open";
  const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);

  try {
    if (tab === "ai_flagged") {
      const { results } = await env.DB.prepare(`
        SELECT id, entity_type, entity_id, user_id, language, decision, severity,
               flags, source, confidence, explanation, created_at
          FROM moderation_decisions
         WHERE decision IN ('review', 'block')
         ORDER BY created_at DESC
         LIMIT ?
      `).bind(limit).all();
      return json({ tab, items: results || [] });
    }

    // Default: reports
    const { results } = await env.DB.prepare(`
      SELECT r.*,
             ur.username AS reporter_name,
             uh.username AS handler_name
        FROM reports r
   LEFT JOIN users ur ON ur.id = r.reporter_id
   LEFT JOIN users uh ON uh.id = r.handled_by
       WHERE r.status = ?
       ORDER BY r.created_at DESC
       LIMIT ?
    `).bind(status, limit).all();

    // Enrich with snippet of reported content
    const enriched = [];
    for (const r of results || []) {
      let snippet = null;
      let authorUsername = null;
      let authorId = null;
      if (r.entity_type === "post") {
        const p = await env.DB.prepare(
          "SELECT user_id, username, content FROM posts WHERE id = ?"
        ).bind(r.entity_id).first();
        if (p) { snippet = (p.content || "").slice(0, 300); authorUsername = p.username; authorId = p.user_id; }
      } else if (r.entity_type === "topic") {
        const t = await env.DB.prepare(
          "SELECT user_id, username, title, content FROM topics WHERE id = ?"
        ).bind(r.entity_id).first();
        if (t) { snippet = `${t.title} — ${(t.content || "").slice(0, 240)}`; authorUsername = t.username; authorId = t.user_id; }
      } else if (r.entity_type === "user") {
        const u = await env.DB.prepare(
          "SELECT id, username FROM users WHERE id = ?"
        ).bind(r.entity_id).first();
        if (u) { snippet = `user: ${u.username}`; authorUsername = u.username; authorId = u.id; }
      }
      enriched.push({ ...r, snippet, author_username: authorUsername, author_id: authorId });
    }

    return json({ tab, items: enriched });
  } catch (e) {
    console.error("queue error:", e);
    return json({ error: e.message }, 500);
  }
}
