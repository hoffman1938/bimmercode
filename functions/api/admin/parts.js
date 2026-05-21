import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequest(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "GET") {
    const code = url.searchParams.get("error_code");
    let q = "SELECT * FROM error_code_parts";
    const params = [];
    if (code) {
      q += " WHERE error_code = ?";
      params.push(code);
    }
    q += " ORDER BY priority ASC LIMIT 100";
    const { results } = await env.DB.prepare(q).bind(...params).all();
    return json({ success: true, parts: results });
  }

  if (request.method === "POST") {
    const b = await request.json();
    const id = b.id || crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO error_code_parts (id, error_code, part_name_en, part_name_ru, oem_number,
        part_category, price_min, price_max, priority)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
      .bind(
        id,
        b.error_code,
        b.part_name_en,
        b.part_name_ru || null,
        b.oem_number,
        b.part_category || "engine",
        b.price_min || null,
        b.price_max || null,
        b.priority || 1
      )
      .run();
    return json({ success: true, id });
  }

  if (request.method === "PUT") {
    const b = await request.json();
    if (!b.id) return json({ error: "id required" }, 400);
    await env.DB.prepare(
      `UPDATE error_code_parts SET error_code=?, part_name_en=?, part_name_ru=?,
        oem_number=?, part_category=?, price_min=?, price_max=?, priority=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    )
      .bind(
        b.error_code,
        b.part_name_en,
        b.part_name_ru,
        b.oem_number,
        b.part_category,
        b.price_min,
        b.price_max,
        b.priority,
        b.id
      )
      .run();
    return json({ success: true });
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);
    await env.DB.prepare("DELETE FROM error_code_parts WHERE id = ?").bind(id).run();
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
