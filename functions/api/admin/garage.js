import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequest(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "GET") {
    const status = url.searchParams.get("status") || "all";
    let q = `SELECT v.*, u.username FROM user_vehicles v LEFT JOIN users u ON v.user_id = u.id`;
    if (status === "pending") q += " WHERE v.is_approved = 0";
    q += " ORDER BY v.created_at DESC LIMIT 100";
    const { results } = await env.DB.prepare(q).all();
    return json({ success: true, vehicles: results });
  }

  if (request.method === "PUT") {
    const b = await request.json();
    if (!b.id) return json({ error: "id required" }, 400);
    const sets = [];
    const params = [];
    if (b.is_approved !== undefined) {
      sets.push("is_approved = ?");
      params.push(b.is_approved ? 1 : 0);
    }
    if (b.is_featured !== undefined) {
      sets.push("is_featured = ?");
      params.push(b.is_featured ? 1 : 0);
    }
    if (!sets.length) return json({ error: "Nothing to update" }, 400);
    sets.push("updated_at = CURRENT_TIMESTAMP");
    params.push(b.id);
    await env.DB.prepare(`UPDATE user_vehicles SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params)
      .run();
    return json({ success: true });
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    await env.DB.prepare("DELETE FROM user_vehicles WHERE id = ?").bind(id).run();
    return json({ success: true });
  }

  return json({ error: "Method not allowed" }, 405);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
