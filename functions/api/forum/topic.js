// functions/api/forum/topic.js
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  if (request.method === "GET") {
    const id = url.searchParams.get("id"); // Можно искать по ID
    // const slug = url.searchParams.get("slug"); // Или по slug (лучше для SEO)
    
    if (!id) return new Response("ID required", { status: 400 });

    try {
      // 1. Тема + Инфо об авторе (Машина, Репутация)
      const topic = await db.prepare(`
        SELECT t.*, 
               u.username, u.avatar_url, u.role, u.reputation,
               u.bmw_model, u.bmw_chassis
        FROM topics t
        JOIN users u ON t.user_id = u.id
        WHERE t.id = ?
      `).bind(id).first();

      if (!topic) return new Response("Not found", { status: 404 });

      // 2. Ответы
      const { results: posts } = await db.prepare(`
        SELECT p.*, 
               u.username, u.avatar_url, u.role, u.reputation,
               u.bmw_model, u.bmw_chassis
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.topic_id = ?
        ORDER BY p.created_at ASC
      `).bind(id).all();

      // Счетчик просмотров (fire & forget)
      context.waitUntil(
        db.prepare("UPDATE topics SET views = views + 1 WHERE id = ?").bind(id).run()
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