import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequest(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;

  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM notification_templates ORDER BY type"
    ).all();
    return json({ success: true, templates: results });
  }

  if (request.method === "POST" || request.method === "PUT") {
    const b = await request.json();
    const id = b.id || crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO notification_templates (id, type, title_template, body_template, channel, enabled)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(type) DO UPDATE SET title_template=excluded.title_template,
         body_template=excluded.body_template, channel=excluded.channel, enabled=excluded.enabled`
    )
      .bind(
        id,
        b.type,
        b.title_template,
        b.body_template,
        b.channel || "in_app",
        b.enabled !== false ? 1 : 0
      )
      .run();
    return json({ success: true, id });
  }

  return json({ error: "Method not allowed" }, 405);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
