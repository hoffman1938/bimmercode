// functions/api/forum/post.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const postId = url.searchParams.get("id");

  // === 1. УДАЛЕНИЕ ПОСТА (DELETE) ===
  if (request.method === "DELETE") {
    if (!postId) return new Response("ID required", { status: 400 });

    try {
      // В реальном проекте тут нужно проверить сессию пользователя!
      // Сейчас мы просто удаляем по ID (для MVP).
      
      await db.prepare("DELETE FROM posts WHERE id = ?").bind(postId).run();
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // === 2. РЕДАКТИРОВАНИЕ ПОСТА (PUT) ===
  if (request.method === "PUT") {
    try {
      const data = await request.json();
      if (!data.id || !data.content) return new Response("Missing data", { status: 400 });

      await db.prepare("UPDATE posts SET content = ? WHERE id = ?")
        .bind(data.content, data.id)
        .run();

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}