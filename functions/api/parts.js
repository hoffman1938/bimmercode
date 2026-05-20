// GET /api/parts?code=P0100&lang=en[&vin=...]
// Returns parts grouped by priority for Parts Finder UI.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function bucketParts(rows) {
  const parts = { primary: [], secondary: [], optional: [] };
  let min = 0;
  let max = 0;
  let hasPrice = false;

  for (const row of rows) {
    const priority = Number(row.priority) || 1;
    const part = {
      ...row,
      is_original: !!row.is_original,
      price_min: row.price_min != null ? Number(row.price_min) : null,
      price_max: row.price_max != null ? Number(row.price_max) : null,
      links: row.links || [],
      compatibility: row.compatibility || [],
    };

    if (part.price_min != null && part.price_max != null) {
      min += part.price_min;
      max += part.price_max;
      hasPrice = true;
    }

    if (priority <= 1) parts.primary.push(part);
    else if (priority === 2) parts.secondary.push(part);
    else parts.optional.push(part);
  }

  return {
    parts,
    estimated_cost: hasPrice ? { min, max } : { min: 0, max: 0 },
  };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = normalizeCode(url.searchParams.get("code"));
  const lang = (url.searchParams.get("lang") || "en").toLowerCase();

  if (!code) {
    return json({ error: "code parameter required" }, 400);
  }

  if (!env.DB) {
    return json({ error: "Database not configured" }, 503);
  }

  try {
    const { results: partRows } = await env.DB.prepare(
      `SELECT id, error_code, part_name_en, part_name_ru, part_name_ka,
              part_category, oem_number, manufacturer, is_original,
              price_min, price_max, currency, priority,
              compatibility_notes, installation_difficulty,
              estimated_labor_hours, warranty_months, notes
         FROM error_code_parts
        WHERE UPPER(error_code) = ?
        ORDER BY priority ASC, part_name_en ASC`
    )
      .bind(code)
      .all();

    if (!partRows?.length) {
      return json({
        parts: { primary: [], secondary: [], optional: [] },
        estimated_cost: { min: 0, max: 0 },
      });
    }

    const ids = partRows.map((p) => p.id);
    const placeholders = ids.map(() => "?").join(",");

    const { results: linkRows } = await env.DB.prepare(
      `SELECT id, part_id, marketplace, region, affiliate_url, product_title,
              current_price, original_price, currency, in_stock,
              seller_rating, shipping_cost, estimated_delivery_days
         FROM part_affiliate_links
        WHERE part_id IN (${placeholders}) AND COALESCE(in_stock, 1) = 1
        ORDER BY current_price ASC`
    )
      .bind(...ids)
      .all();

    const linksByPart = {};
    for (const link of linkRows || []) {
      (linksByPart[link.part_id] ||= []).push({
        ...link,
        in_stock: link.in_stock !== 0,
        current_price: link.current_price != null ? Number(link.current_price) : 0,
        shipping_cost: link.shipping_cost != null ? Number(link.shipping_cost) : 0,
      });
    }

    const enriched = partRows.map((row) => ({
      ...row,
      part_name_en: row.part_name_en,
      part_name_ru: row.part_name_ru,
      part_name_ka: row.part_name_ka,
      display_name: row[`part_name_${lang}`] || row.part_name_en,
      links: linksByPart[row.id] || [],
    }));

    return json(bucketParts(enriched));
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("no such table: error_code_parts")) {
      return json({
        parts: { primary: [], secondary: [], optional: [] },
        estimated_cost: { min: 0, max: 0 },
      });
    }
    console.error("GET /api/parts", e);
    return json({ error: msg }, 500);
  }
}
