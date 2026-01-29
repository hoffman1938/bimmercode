// functions/api/forum/topics.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === 1. ПОЛУЧЕНИЕ СПИСКА ТЕМ ===
  if (request.method === "GET") {
    try {
      const category = url.searchParams.get("category");
      const search = url.searchParams.get("search");

      let query = `
        SELECT t.*, u.username, u.avatar_url 
        FROM topics t 
        LEFT JOIN users u ON t.user_id = u.id 
      `;
      
      const params = [];
      const conditions = [];

      if (category && category !== 'all') {
        conditions.push("t.category_slug = ?");
        params.push(category);
      }

      if (search) {
        conditions.push("(t.title LIKE ? OR t.content LIKE ?)");
        params.push(`%${search}%`);
        params.push(`%${search}%`);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY t.created_at DESC LIMIT 50";

      const { results } = await db.prepare(query).bind(...params).all();
      
      return new Response(JSON.stringify(results || []), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 200 }); // Не падать с 500
    }
  }

  // === 2. СОЗДАНИЕ ТЕМЫ (FIXED) ===
  if (request.method === "POST") {
    try {
      const data = await request.json();
      
      // Валидация
      if (!data.title || !data.content || !data.user_id || !data.category_slug) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
      }

      // Генерируем slug: "My Topic Title" -> "my-topic-title-x7z9"
      const slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substring(2, 6);

      // Вставляем в БД (Используем правильные имена колонок!)
      const result = await db.prepare(
        `INSERT INTO topics (slug, category_slug, user_id, title, content, created_at, last_activity_at, views, reply_count) 
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0)`
      ).bind(slug, data.category_slug, data.user_id, data.title, data.content).run();

      if (!result.success) {
        throw new Error("Failed to insert into database");
      }

      return new Response(JSON.stringify({ success: true, slug: slug }), { status: 201 });

    } catch (e) {
      console.error("Create topic error:", e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}