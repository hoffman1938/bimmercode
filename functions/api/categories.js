// functions/api/categories.js — public categories list with i18n
export async function onRequestGet(context) {
  const { env, request } = context;
  const lang = (new URL(request.url).searchParams.get("lang") || "en").toLowerCase();

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, slug, title, title_en, title_ru, title_ka,
              description, description_en, description_ru, description_ka,
              icon, color, sort_order, is_active
         FROM categories
        WHERE is_active = 1
        ORDER BY sort_order ASC, title ASC`
    ).all();

    const pickTitle = (row) =>
      row[`title_${lang}`] || row.title_en || row.title;
    const pickDesc = (row) =>
      row[`description_${lang}`] || row.description_en || row.description || "";

    // Counts per category (topics, last activity)
    const counts = await env.DB.prepare(
      `SELECT category, COUNT(*) AS topics_count, MAX(COALESCE(last_reply_at, created_at)) AS last_activity
         FROM topics
        WHERE (is_archived IS NULL OR is_archived = 0)
        GROUP BY category`
    ).all();
    const countsBySlug = {};
    for (const c of counts.results || []) countsBySlug[c.category] = c;

    const categories = (results || []).map((row) => ({
      id: row.id,
      slug: row.slug,
      title: pickTitle(row),
      description: pickDesc(row),
      icon: row.icon || "fas fa-folder",
      color: row.color || "#1C69D4",
      sort_order: row.sort_order,
      topics_count: countsBySlug[row.slug]?.topics_count || 0,
      last_activity: countsBySlug[row.slug]?.last_activity || null,
    }));

    return new Response(JSON.stringify({ success: true, categories }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
