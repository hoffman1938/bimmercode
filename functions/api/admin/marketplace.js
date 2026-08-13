import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequest(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "GET") {
    const status = url.searchParams.get("status") || "pending";
    const { results } = await env.DB.prepare(
      `SELECT l.*, u.username FROM marketplace_listings l
       LEFT JOIN users u ON l.user_id = u.id
       WHERE l.status = ? ORDER BY l.created_at DESC LIMIT 100`
    )
      .bind(status)
      .all();
    return json({ success: true, listings: results });
  }

  if (request.method === "PUT") {
    const b = await request.json();
    if (!b.id || !b.status) return json({ error: "id and status required" }, 400);
    await env.DB.prepare(
      "UPDATE marketplace_listings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
      .bind(b.status, b.id)
      .run();
    return json({ success: true });
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    await env.DB.prepare("DELETE FROM marketplace_listings WHERE id = ?").bind(id).run();
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
