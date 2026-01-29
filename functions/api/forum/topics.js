// functions/api/forum/topics.js
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === GET: СПИСОК ТЕМ ===
  if (request.method === "GET") {
    try {
      const category = url.searchParams.get("category");
      const lang = url.searchParams.get("lang") || 'en'; // Фильтр по языку интерфейса
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
        .replace(/[^a-z0-9а-яё]/g, '-') // Разрешаем кириллицу в slug для SEO? Лучше транслит, но пока так
        .replace(/-+/g, '-')
        .replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substring(2, 6);

      // Вставка темы
      const res = await db.prepare(
        `INSERT INTO topics (slug, category_slug, user_id, title, content, lang, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'open')`
      ).bind(slug, data.category_slug, data.user_id, data.title, data.content, data.lang || 'en').run();

      // Вставка первого поста (дублируем контент в таблицу posts для удобства, или оставляем только в topics)
      // В нашей схеме контент есть в topics, но логичнее иметь его и как пост #1 для рендеринга
      // Пока оставим просто в topics, как в старом коде, или можно добавить в posts:
      await db.prepare(
        `INSERT INTO posts (topic_id, user_id, content) VALUES (?, ?, ?)`
      ).bind(res.meta.last_row_id, data.user_id, data.content).run();

      return new Response(JSON.stringify({ success: true, slug: slug }), { status: 201 });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
  
  return new Response("Method not allowed", { status: 405 });
}