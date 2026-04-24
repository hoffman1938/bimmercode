// functions/api/admin/moderation/queue.js
// GET /api/admin/moderation/queue?tab=reports|ai_flagged&status=pending&limit=50
//
// Works against the existing `reports` schema (schema.sql):
//   reported_entity_type, reported_entity_id, reported_user_id,
//   reason, description, status ('pending'|'resolved'|'dismissed'), moderator_id

import { authenticateAdminRequest } from "../../../lib/admin-gate.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") || "reports";
  const status = url.searchParams.get("status") || "pending";
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

    // Default: reports queue
    const { results } = await env.DB.prepare(`
      SELECT r.id,
             r.reporter_id,
             r.reported_entity_type AS entity_type,
             r.reported_entity_id   AS entity_id,
             r.reported_user_id,
             r.reason,
             r.description,
             r.status,
             r.moderator_id,
             r.resolution_notes,
             r.created_at,
             r.resolved_at,
             ur.username AS reporter_name,
             uh.username AS handler_name,
             ut.username AS reported_username
        FROM reports r
   LEFT JOIN users ur ON ur.id = r.reporter_id
   LEFT JOIN users uh ON uh.id = r.moderator_id
   LEFT JOIN users ut ON ut.id = r.reported_user_id
       WHERE r.status = ?
       ORDER BY r.created_at DESC
       LIMIT ?
    `).bind(status, limit).all();

    // Enrich with a snippet of the reported content
    const enriched = [];
    for (const r of results || []) {
      let snippet = null;
      let authorUsername = r.reported_username || null;
      let authorId = r.reported_user_id || null;

      if (r.entity_type === "post") {
        const p = await env.DB.prepare(
          "SELECT user_id, username, content FROM posts WHERE id = ?"
        ).bind(r.entity_id).first();
        if (p) {
          snippet = (p.content || "").slice(0, 300);
          authorUsername = authorUsername || p.username;
          authorId = authorId || p.user_id;
        }
      } else if (r.entity_type === "topic") {
        const t = await env.DB.prepare(
          "SELECT user_id, username, title, content FROM topics WHERE id = ?"
        ).bind(r.entity_id).first();
        if (t) {
          snippet = `${t.title} — ${(t.content || "").slice(0, 240)}`;
          authorUsername = authorUsername || t.username;
          authorId = authorId || t.user_id;
        }
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
