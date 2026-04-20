// functions/api/forum/tags.js
// Public tag endpoints:
//   GET /api/forum/tags            -> top 30 tags by usage
//   GET /api/forum/tags?search=...  -> autocomplete

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 100);

  try {
    let query, params;
    if (search) {
      query = `
        SELECT t.id, t.name, t.color, COUNT(tt.topic_id) AS usage_count
          FROM tags t
     LEFT JOIN topic_tags tt ON tt.tag_id = t.id
         WHERE t.name LIKE ?
      GROUP BY t.id
      ORDER BY usage_count DESC, t.name ASC
         LIMIT ?`;
      params = [`${search}%`, limit];
    } else {
      query = `
        SELECT t.id, t.name, t.color, COUNT(tt.topic_id) AS usage_count
          FROM tags t
     LEFT JOIN topic_tags tt ON tt.tag_id = t.id
      GROUP BY t.id
      ORDER BY usage_count DESC, t.name ASC
         LIMIT ?`;
      params = [limit];
    }

    const { results } = await env.DB.prepare(query).bind(...params).all();
    return new Response(JSON.stringify({ success: true, tags: results || [] }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
