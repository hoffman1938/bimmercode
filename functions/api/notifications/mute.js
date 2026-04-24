// GET    (auth) — list mutes for current user
// POST   { scope: "topic"|"user", target_id } — mute
// DELETE { scope, target_id } — unmute
import { verifyToken } from "../../lib/jwt.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function getUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  return verifyToken(token, env.JWT_SECRET || "secret-dev-key");
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const user = await getUser(request, env);

  if (method === "GET") {
    if (!user?.id) return json({ error: "Unauthorized" }, 401);
    try {
      const { results } = await env.DB
        .prepare(
          `SELECT id, scope, target_id, created_at
             FROM notification_mutes
            WHERE user_id = ?
         ORDER BY datetime(created_at) DESC`
        )
        .bind(user.id)
        .all();
      return json({ mutes: results || [] });
    } catch (e) {
      return json({ error: e.message || String(e) }, 500);
    }
  }

  if (method !== "POST" && method !== "DELETE") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!user?.id) return json({ error: "Unauthorized" }, 401);

  let body = {};
  try {
    body = (await request.json()) || {};
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const scope = body.scope;
  const targetId = body.target_id != null ? String(body.target_id).trim() : "";
  if (!["topic", "user"].includes(scope) || !targetId) {
    return json({ error: "scope must be 'topic' or 'user' and target_id is required" }, 400);
  }

  const db = env.DB;
  const id = crypto.randomUUID();

  try {
    if (method === "POST") {
      await db
        .prepare(
          `INSERT OR IGNORE INTO notification_mutes (id, user_id, scope, target_id)
           VALUES (?, ?, ?, ?)`
        )
        .bind(id, user.id, scope, targetId)
        .run();
      return json({ success: true, scope, target_id: targetId });
    }

    await db
      .prepare(
        `DELETE FROM notification_mutes WHERE user_id = ? AND scope = ? AND target_id = ?`
      )
      .bind(user.id, scope, targetId)
      .run();
    return json({ success: true, scope, target_id: targetId });
  } catch (e) {
    return json({ error: e.message || String(e) }, 500);
  }
}
