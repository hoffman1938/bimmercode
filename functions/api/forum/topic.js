export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === 1. ПОЛУЧЕНИЕ ТЕМЫ (GET) ===
  if (request.method === "GET") {
    const topicId = url.searchParams.get("id");
    const currentUserId = url.searchParams.get("user_id"); // ID текущего пользователя

    if (!topicId) {
      return new Response(JSON.stringify({ error: "ID required" }), { status: 400 });
    }

    try {
      // 1. Получаем саму тему
      const topic = await db.prepare("SELECT * FROM topics WHERE id = ?").bind(topicId).first();

      if (!topic) {
        return new Response(JSON.stringify({ error: "Topic not found" }), { status: 404 });
      }

      // 2. Получаем ответы + Лайки + Статус "Решение"
      const query = `
        SELECT 
          p.*,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
          (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
        FROM posts p 
        WHERE p.topic_id = ? 
        ORDER BY p.created_at ASC
      `;
      
      const { results: posts } = await db.prepare(query)
        .bind(currentUserId || 0, topicId)
        .all();

      // 3. Увеличиваем счетчик просмотров
      await db.prepare("UPDATE topics SET views = views + 1 WHERE id = ?").bind(topicId).run();

      return new Response(JSON.stringify({ topic, posts }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // === 2. СОЗДАНИЕ ОТВЕТА (POST) ===
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

      // --- СОЗДАНИЕ УВЕДОМЛЕНИЯ ОБ ОТВЕТЕ ---
      // Узнаем, кто автор темы
      const topic = await db.prepare("SELECT user_id, title FROM topics WHERE id = ?").bind(data.topic_id).first();
      
      // Если тема существует и отвечает НЕ сам автор темы
      if (topic && topic.user_id !== parseInt(data.user_id)) {
        await db.prepare(`
          INSERT INTO notifications (user_id, sender_id, sender_name, type, topic_id, topic_title)
          VALUES (?, ?, ?, 'reply', ?, ?)
        `).bind(topic.user_id, data.user_id, data.username, data.topic_id, topic.title).run();
      }
      // ---------------------------------------

      return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // === 3. УДАЛЕНИЕ ТЕМЫ (DELETE) ===
  if (request.method === "DELETE") {
    const topicId = url.searchParams.get("id");

    if (!topicId) {
      return new Response(JSON.stringify({ error: "ID required" }), { status: 400 });
    }

    try {
      // Удаляем ответы
      await db.prepare("DELETE FROM posts WHERE topic_id = ?").bind(topicId).run();
      // Удаляем тему
      await db.prepare("DELETE FROM topics WHERE id = ?").bind(topicId).run();
      // Удаляем уведомления, связанные с темой (чтобы не было битых ссылок)
      await db.prepare("DELETE FROM notifications WHERE topic_id = ?").bind(topicId).run();
      
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}