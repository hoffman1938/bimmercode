export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === GET: Получить тему и посты ===
  if (request.method === "GET") {
    const topicId = url.searchParams.get("id");
    const currentUserId = url.searchParams.get("user_id"); // ID текущего юзера

    if (!topicId)
      return new Response(JSON.stringify({ error: "ID required" }), {
        status: 400,
      });

    try {
      // ИЗМЕНЕННЫЙ ЗАПРОС (ДОБАВЛЯЕМ JOIN С ТАБЛИЦЕЙ ЮЗЕРОВ)
      const topic = await db
        .prepare(
          `
          SELECT t.*, u.avatar_url as author_avatar, u.role_id as author_role, u.reputation as author_reputation
          FROM topics t
          LEFT JOIN users u ON t.user_id = u.id
          WHERE t.id = ?
        `,
        )
        .bind(topicId)
        .first();

      if (!topic)
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
        });

      // ВАЖНОЕ ИСПРАВЛЕНИЕ:
      // Мы используем LEFT JOIN или подзапрос, чтобы узнать is_liked для конкретного юзера
      // И считаем общее количество лайков
      let postsQuery = `
  SELECT 
    p.*,
    u.avatar_url as author_avatar,  -- Достаем аватарку автора
    u.role_id as author_role,          -- Достаем роль автора
    u.reputation as author_reputation, -- Достаем репутацию автора
    (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
    EXISTS (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
  FROM posts p 
  LEFT JOIN users u ON p.user_id = u.id -- Присоединяем таблицу юзеров
  WHERE p.topic_id = ? 
  ORDER BY p.created_at ASC
`;

      // Если юзер не залогинен, передаем null в user_id, чтобы is_liked был 0
      const safeUserId = currentUserId || "guest";

      const { results: posts } = await db
        .prepare(postsQuery)
        .bind(safeUserId, topicId)
        .all();

      // Конвертируем 1/0 в true/false для фронтенда
      const cleanPosts = posts.map((p) => ({
        ...p,
        is_liked: p.is_liked === 1,
        // D1 возвращает время как строку "YYYY-MM-DD HH:MM:SS". Добавляем 'Z', чтобы считать это UTC
        created_at: p.created_at.endsWith("Z")
          ? p.created_at
          : p.created_at + "Z",
      }));

      // Обновляем просмотры
      context.waitUntil(
        db
          .prepare("UPDATE topics SET views = views + 1 WHERE id = ?")
          .bind(topicId)
          .run(),
      );

      return new Response(JSON.stringify({ topic, posts: cleanPosts }), {
        status: 200,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
      });
    }
  }

  // === POST: Написать ответ ===
  if (request.method === "POST") {
    try {
      const data = await request.json();
      if (!data.topic_id || !data.content || !data.user_id) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400,
        });
      }

      const postId = crypto.randomUUID();

      await db
        .prepare(
          "INSERT INTO posts (id, topic_id, user_id, username, content, lang) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          postId,
          data.topic_id,
          data.user_id,
          data.username,
          data.content,
          data.lang || "en",
        )
        .run();

      // Уведомление автору темы
      const topic = await db
        .prepare("SELECT user_id, title FROM topics WHERE id = ?")
        .bind(data.topic_id)
        .first();
      if (topic && String(topic.user_id) !== String(data.user_id)) {
        const metadata = JSON.stringify({
           sender_id: data.user_id,
           sender_name: data.username,
           topic_id: data.topic_id,
           post_id: postId
        });
        
        await db
          .prepare(
            `
          INSERT INTO notifications (id, user_id, type, title, text, link, icon, metadata)
          VALUES (?, ?, 'reply', ?, ?, ?, 'fa-reply', ?)
        `,
          )
          .bind(
            crypto.randomUUID(),
            topic.user_id,
            "New reply in " + topic.title,
            data.username + " replied to your topic",
            `/topic?id=${data.topic_id}#post-${postId}`,
            metadata
          )
          .run();
      }

      return new Response(JSON.stringify({ success: true, postId }), {
        status: 201,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
      });
    }
  }
}
