// functions/api/forum/topics.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 1. ПОЛУЧЕНИЕ СПИСКА ТЕМ (GET)
  if (request.method === "GET") {
    try {
      // Запрашиваем темы + считаем количество ответов для каждой
      const { results } = await db.prepare(`
        SELECT t.*, COUNT(p.id) as reply_count 
        FROM topics t 
        LEFT JOIN posts p ON p.topic_id = t.id 
        GROUP BY t.id 
        ORDER BY t.created_at DESC
      `).all();
      
      return new Response(JSON.stringify(results), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // 2. СОЗДАНИЕ НОВОЙ ТЕМЫ (POST)
  if (request.method === "POST") {
    try {
      const data = await request.json();
      
      // Валидация
      if (!data.title || !data.content || !data.user_id) {
        return new Response(JSON.stringify({ error: "Заполните все поля" }), { status: 400 });
      }

      // Вставляем тему
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