// GET    /api/user/block?check=<userId>  — { blocked: boolean }  (auth)
// GET    /api/user/block                 — { blocks: [{ blocked_id, created_at }, ...] }  (auth)
// POST   { blocked_id }                  — add block  (auth)
// DELETE /api/user/block?blocked_id=     — remove block  (auth)

import { getViewerIdFromRequest } from "../../lib/user-blocks.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  if (method === "GET") return handleGet({ request, env });
  if (method === "POST") return handlePost({ request, env });
  if (method === "DELETE") return handleDelete({ request, env });
  return new Response("Method not allowed", { status: 405 });
}

async function handleGet({ request, env }) {
  const viewer = await getViewerIdFromRequest(request, env);
  if (!viewer) return json({ error: "Authentication required" }, 401);
  const url = new URL(request.url);
  const check = url.searchParams.get("check");
  const db = env.DB;
  if (check) {
    if (String(check) === String(viewer)) return json({ blocked: false });
    try {
      const row = await db
        .prepare("SELECT 1 AS x FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?")
        .bind(String(viewer), String(check))
        .first();
      return json({ blocked: !!row });
    } catch (e) {
      return json({ error: e.message || String(e) }, 500);
    }
  }
  try {
    const { results } = await db
      .prepare(
        `SELECT blocked_id, created_at FROM user_blocks
          WHERE blocker_id = ?
          ORDER BY datetime(created_at) DESC
          LIMIT 500`
      )
      .bind(String(viewer))
      .all();
    return json({ blocks: results || [] });
  } catch (e) {
    return json({ error: e.message || String(e) }, 500);
  }
}

async function handlePost({ request, env }) {
  const viewer = await getViewerIdFromRequest(request, env);
  if (!viewer) return json({ error: "Authentication required" }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const blockedId = body?.blocked_id != null ? String(body.blocked_id).trim() : "";
  if (!blockedId) return json({ error: "blocked_id required" }, 400);
  if (String(blockedId) === String(viewer)) return json({ error: "Cannot block yourself" }, 400);
  const db = env.DB;
  try {
    const exists = await db.prepare("SELECT 1 FROM users WHERE id = ?").bind(blockedId).first();
    if (!exists) return json({ error: "User not found" }, 404);
    const id = crypto.randomUUID();
    await db
      .prepare("INSERT OR IGNORE INTO user_blocks (id, blocker_id, blocked_id) VALUES (?, ?, ?)")
      .bind(id, String(viewer), blockedId)
      .run();
    return json({ success: true, blocked_id: blockedId });
  } catch (e) {
    return json({ error: e.message || String(e) }, 500);
  }
}

async function handleDelete({ request, env }) {
  const viewer = await getViewerIdFromRequest(request, env);
  if (!viewer) return json({ error: "Authentication required" }, 401);
  const url = new URL(request.url);
  const blockedId = url.searchParams.get("blocked_id");
  if (!blockedId) return json({ error: "blocked_id query required" }, 400);
  const db = env.DB;
  try {
    await db
      .prepare("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?")
      .bind(String(viewer), String(blockedId))
      .run();
    return json({ success: true, blocked_id: blockedId });
  } catch (e) {
    return json({ error: e.message || String(e) }, 500);
  }
}
