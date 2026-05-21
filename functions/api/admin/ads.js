import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequest(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;

  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM ad_slots ORDER BY placement"
    ).all();
    return json({ success: true, slots: results });
  }

  if (request.method === "POST" || request.method === "PUT") {
    const b = await request.json();
    const id = b.id || crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO ad_slots (id, name, placement, html_content, is_active, updated_at)
       VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, placement=excluded.placement,
         html_content=excluded.html_content, is_active=excluded.is_active, updated_at=CURRENT_TIMESTAMP`
    )
      .bind(id, b.name, b.placement, b.html_content || "", b.is_active ? 1 : 0)
      .run();
    return json({ success: true, id });
  }

  if (request.method === "DELETE") {
    const id = new URL(request.url).searchParams.get("id");
    await env.DB.prepare("DELETE FROM ad_slots WHERE id = ?").bind(id).run();
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
