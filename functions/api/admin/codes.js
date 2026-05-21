import { authenticateAdminRequest } from "../../lib/admin-gate.js";
import { jsonEntryToRow, rowToPublic } from "../../lib/dtc-codes.js";

export async function onRequest(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "GET") {
    const code = url.searchParams.get("code");
    if (code) {
      const row = await env.DB.prepare("SELECT * FROM dtc_codes WHERE code = ?")
        .bind(code.toUpperCase())
        .first();
      if (!row) return json({ error: "Not found" }, 404);
      return json({ success: true, code: rowToPublic(row) });
    }
    const search = url.searchParams.get("search") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
    const offset = parseInt(url.searchParams.get("offset")) || 0;
    let q = "SELECT code, severity, title_en, is_published, updated_at FROM dtc_codes";
    const params = [];
    if (search) {
      q += " WHERE code LIKE ? OR title_en LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }
    q += " ORDER BY code LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const { results } = await env.DB.prepare(q).bind(...params).all();
    return json({ success: true, codes: results });
  }

  if (request.method === "POST") {
    const body = await request.json();
    const r = jsonEntryToRow(body);
    await env.DB.prepare(
      `INSERT INTO dtc_codes (code, slug, severity, category, title_en, title_ru, title_ka,
        description_en, description_ru, description_ka, solutions_en, solutions_ru, solutions_ka,
        applicable_models, related_codes, seo_title, seo_description, is_published)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        r.code,
        r.slug,
        r.severity,
        r.category,
        r.title_en,
        r.title_ru,
        r.title_ka,
        r.description_en,
        r.description_ru,
        r.description_ka,
        r.solutions_en,
        r.solutions_ru,
        r.solutions_ka,
        r.applicable_models,
        r.related_codes,
        r.seo_title,
        r.seo_description,
        body.is_published !== false ? 1 : 0
      )
      .run();
    return json({ success: true, code: r.code });
  }

  if (request.method === "PUT") {
    const body = await request.json();
    const r = jsonEntryToRow(body);
    await env.DB.prepare(
      `UPDATE dtc_codes SET slug=?, severity=?, category=?, title_en=?, title_ru=?, title_ka=?,
        description_en=?, description_ru=?, description_ka=?, solutions_en=?, solutions_ru=?,
        solutions_ka=?, applicable_models=?, related_codes=?, seo_title=?, seo_description=?,
        is_published=?, updated_at=CURRENT_TIMESTAMP WHERE code=?`
    )
      .bind(
        r.slug,
        r.severity,
        r.category,
        r.title_en,
        r.title_ru,
        r.title_ka,
        r.description_en,
        r.description_ru,
        r.description_ka,
        r.solutions_en,
        r.solutions_ru,
        r.solutions_ka,
        r.applicable_models,
        r.related_codes,
        r.seo_title,
        r.seo_description,
        body.is_published !== false ? 1 : 0,
        r.code
      )
      .run();
    return json({ success: true });
  }

  if (request.method === "DELETE") {
    const code = url.searchParams.get("code");
    if (!code) return json({ error: "code required" }, 400);
    await env.DB.prepare("DELETE FROM dtc_codes WHERE code = ?").bind(code.toUpperCase()).run();
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
