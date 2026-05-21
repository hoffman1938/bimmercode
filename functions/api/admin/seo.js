import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequest(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "meta";

  if (request.method === "GET") {
    if (type === "redirects") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM seo_redirects ORDER BY created_at DESC LIMIT 200"
      ).all();
      return json({ success: true, redirects: results });
    }
    const { results } = await env.DB.prepare(
      "SELECT * FROM seo_meta ORDER BY updated_at DESC LIMIT 200"
    ).all();
    return json({ success: true, meta: results });
  }

  if (request.method === "POST") {
    const b = await request.json();
    if (type === "redirects") {
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO seo_redirects (id, from_path, to_path, status_code) VALUES (?,?,?,?)"
      )
        .bind(id, b.from_path, b.to_path, b.status_code || 301)
        .run();
      return json({ success: true, id });
    }
    await env.DB.prepare(
      `INSERT INTO seo_meta (path, title, description, canonical, schema_json, updated_at)
       VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
       ON CONFLICT(path) DO UPDATE SET title=excluded.title, description=excluded.description,
         canonical=excluded.canonical, schema_json=excluded.schema_json, updated_at=CURRENT_TIMESTAMP`
    )
      .bind(b.path, b.title, b.description, b.canonical || null, b.schema_json || null)
      .run();
    return json({ success: true });
  }

  if (request.method === "DELETE") {
    if (type === "redirects") {
      await env.DB.prepare("DELETE FROM seo_redirects WHERE id = ?")
        .bind(url.searchParams.get("id"))
        .run();
    } else {
      await env.DB.prepare("DELETE FROM seo_meta WHERE path = ?")
        .bind(url.searchParams.get("path"))
        .run();
    }
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
