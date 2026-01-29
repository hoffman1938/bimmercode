// functions/api/forum/topic.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  if (request.method === "GET") {
    const topicId = url.searchParams.get("id");
    
    if (!topicId) return new Response("ID required", { status: 400 });

    try {
      // 1. Получаем саму тему + инфо об авторе
      const topic = await db.prepare(`
        SELECT t.*, u.username, u.avatar_url, u.role
        FROM topics t
        JOIN users u ON t.user_id = u.id
        WHERE t.id = ?
      `).bind(topicId).first();

      if (!topic) return new Response("Not found", { status: 404 });

      // 2. Получаем ответы (posts)
      const { results: posts } = await db.prepare(`
        SELECT p.*, u.username, u.avatar_url, u.role
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.topic_id = ?
        ORDER BY p.created_at ASC
      `).bind(topicId).all();

      // 3. Увеличиваем счетчик просмотров (асинхронно, не ждем)
      context.waitUntil(
        db.prepare("UPDATE topics SET views = views + 1 WHERE id = ?").bind(topicId).run()
      );

      return new Response(JSON.stringify({ topic, posts }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
  
  return new Response("Method not allowed", { status: 405 });
}