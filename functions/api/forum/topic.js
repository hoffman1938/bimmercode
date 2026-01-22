// functions/api/forum/topic.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
// === УДАЛЕНИЕ ТЕМЫ (DELETE) ===
  if (request.method === "DELETE") {
    const topicId = url.searchParams.get("id");
    if (!topicId) return new Response("ID required", { status: 400 });

    try {
      // Сначала удаляем все ответы к теме
      await db.prepare("DELETE FROM posts WHERE topic_id = ?").bind(topicId).run();
      // Затем саму тему
      await db.prepare("DELETE FROM topics WHERE id = ?").bind(topicId).run();
      
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
  // === 1. ПОЛУЧЕНИЕ ТЕМЫ И ОТВЕТОВ (GET) ===
  if (request.method === "GET") {
    const topicId = url.searchParams.get("id");

    if (!topicId) {
      return new Response(JSON.stringify({ error: "ID required" }), { status: 400 });
    }

    try {
      // 1. Получаем саму тему
      const topic = await db.prepare("SELECT * FROM topics WHERE id = ?").bind(topicId).first();

      if (!topic) {
        return new Response(JSON.stringify({ error: "Topic not found" }), { status: 404 });
      }

      // 2. Получаем ответы к теме (сортировка: старые сверху)
      const { results: posts } = await db.prepare("SELECT * FROM posts WHERE topic_id = ? ORDER BY created_at ASC").bind(topicId).all();

      // 3. Увеличиваем счетчик просмотров (асинхронно, не ждем)
      // В реальном проекте это лучше делать реже, чтобы не грузить базу
      await db.prepare("UPDATE topics SET views = views + 1 WHERE id = ?").bind(topicId).run();

      return new Response(JSON.stringify({ topic, posts }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // === 2. ДОБАВЛЕНИЕ ОТВЕТА (POST) ===
  if (request.method === "POST") {
    try {
      const data = await request.json();

      if (!data.topic_id || !data.content || !data.user_id) {
        return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
      }

      // Вставляем ответ
      await db.prepare(
        "INSERT INTO posts (topic_id, user_id, username, content) VALUES (?, ?, ?, ?)"
      ).bind(data.topic_id, data.user_id, data.username, data.content).run();

      return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}