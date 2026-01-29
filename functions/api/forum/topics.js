// functions/api/forum/topics.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === 1. ПОЛУЧЕНИЕ ТЕМ (с фильтрами) ===
  if (request.method === "GET") {
    try {
      const category = url.searchParams.get("category"); // Получаем ?category=...
      const search = url.searchParams.get("search");     // Получаем ?search=...

      let query = `
        SELECT t.*, COUNT(p.id) as reply_count 
        FROM topics t 
        LEFT JOIN posts p ON p.topic_id = t.id 
      `;
      
      const params = [];
      const conditions = [];

      // Фильтр по категории
      if (category && category !== 'all') {
        conditions.push("t.category = ?");
        params.push(category);
      }

      // Поиск по заголовку или тексту
      if (search) {
        conditions.push("(t.title LIKE ? OR t.content LIKE ?)");
        params.push(`%${search}%`);
        params.push(`%${search}%`);
      }

      // Если есть условия, добавляем WHERE
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " GROUP BY t.id ORDER BY t.created_at DESC";

      // Выполняем умный запрос
      const stmt = db.prepare(query).bind(...params);
      const { results } = await stmt.all();
      
      return new Response(JSON.stringify(results), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // === 2. СОЗДАНИЕ НОВОЙ ТЕМЫ (Оставляем как было) ===
  if (request.method === "POST") {
    try {
      const data = await request.json();
      if (!data.title || !data.content || !data.user_id) {
        return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
      }
      const result = await db.prepare(
        "INSERT INTO topics (user_id, username, category, title, content) VALUES (?, ?, ?, ?, ?)"
      ).bind(data.user_id, data.username, data.category, data.title, data.content).run();

      return new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { status: 201 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}