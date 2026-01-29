// functions/api/forum/topics.js
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === GET: СПИСОК ТЕМ ===
  if (request.method === "GET") {
    try {
      const category = url.searchParams.get("category");
      const lang = url.searchParams.get("lang") || 'en';
      const limit = 50;

      let query = `
        SELECT t.*, u.username, u.avatar_url, u.reputation, u.role
        FROM topics t 
        LEFT JOIN users u ON t.user_id = u.id 
        WHERE t.lang = ? 
      `;
      
      const params = [lang];

      if (category && category !== 'all') {
        query += " AND t.category_slug = ?";
        params.push(category);
      }

      query += " ORDER BY t.last_activity_at DESC LIMIT ?";
      params.push(limit);

      const { results } = await db.prepare(query).bind(...params).all();
      return new Response(JSON.stringify(results || []), { status: 200 });
    } catch (e) {
      console.error("GET Topics Error:", e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // === POST: СОЗДАНИЕ ТЕМЫ ===
  if (request.method === "POST") {
    try {
      const data = await request.json();
      
      if (!data.title || !data.content || !data.category_slug || !data.user_id) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
      }

      // Генерация Slug
      const slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]/g, '-')
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substring(2, 6);

      // ВАЖНО: Вставляем тему БЕЗ явного указания 'open' в VALUES
      // Статус должен иметь DEFAULT значение в таблице или вставляться отдельно
      const insertTopicResult = await db.prepare(
        `INSERT INTO topics (slug, category_slug, user_id, title, content, lang, status, created_at, last_activity_at) 
         VALUES (?, ?, ?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(slug, data.category_slug, data.user_id, data.title, data.content, data.lang || 'en').run();

      if (!insertTopicResult.success) {
        throw new Error("Failed to insert topic into database");
      }

      // Получаем ID только что созданной темы
      // В D1 используем LAST_INSERT_ROWID() через отдельный запрос
      const topicIdResult = await db.prepare(
        `SELECT id FROM topics WHERE slug = ? ORDER BY created_at DESC LIMIT 1`
      ).bind(slug).first();

      if (!topicIdResult) {
        throw new Error("Could not retrieve created topic ID");
      }

      const topicId = topicIdResult.id;

      // Вставляем первый пост (содержимое темы как пост #1)
      // Это облегчит рендеринг в topic-view.js
      const insertPostResult = await db.prepare(
        `INSERT INTO posts (topic_id, user_id, content, created_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(topicId, data.user_id, data.content).run();

      if (!insertPostResult.success) {
        console.warn("Warning: Post insertion had issues, but topic created");
      }

      // Обновляем счетчик ответов (первый пост уже в posts)
      await db.prepare(
        `UPDATE topics SET reply_count = 1 WHERE id = ?`
      ).bind(topicId).run();

      return new Response(JSON.stringify({ 
        success: true, 
        slug: slug,
        topicId: topicId
      }), { status: 201, headers: { 'Content-Type': 'application/json' } });

    } catch (e) {
      console.error("POST Topics Error:", e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
  
  return new Response("Method not allowed", { status: 405 });
}