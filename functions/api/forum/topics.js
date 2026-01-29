// functions/api/forum/topics.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === 1. ПОЛУЧЕНИЕ ТЕМ (GET) ===
  if (request.method === "GET") {
    try {
      const category = url.searchParams.get("category");
      const search = url.searchParams.get("search");
      
      let query = `
        SELECT t.*, u.username, u.avatar_url 
        FROM topics t
        JOIN users u ON t.user_id = u.id
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

      query += " ORDER BY t.last_activity_at DESC LIMIT 50";

      const { results } = await db.prepare(query).bind(...params).all();

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // === 2. СОЗДАНИЕ ТЕМЫ (POST) ===
  if (request.method === "POST") {
    try {
      const data = await request.json();
      
      // Валидация
      if (!data.title || !data.content || !data.category_slug || !data.user_id) {
        return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
      }

      // Генерируем slug (ссылку) из заголовка
      // Пример: "Engine Noise" -> "engine-noise-178f8a"
      const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substr(2, 6);

      const result = await db.prepare(
        `INSERT INTO topics (slug, category_slug, user_id, title, content, created_at, last_activity_at) 
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(slug, data.category_slug, data.user_id, data.title, data.content).run();

      if (!result.success) throw new Error("DB Insert failed");

      return new Response(JSON.stringify({ success: true, slug: slug }), { status: 201 });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}