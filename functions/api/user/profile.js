// functions/api/user/profile.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // 1. ПОЛУЧИТЬ ПРОФИЛЬ (GET)
  if (request.method === "GET") {
    const userId = url.searchParams.get("id");
    if (!userId) return new Response("ID required", { status: 400 });

    const user = await db.prepare("SELECT id, username, email, car_model, bio, avatar_url, role, reputation, created_at FROM users WHERE id = ?").bind(userId).first();
    
    if (!user) return new Response("User not found", { status: 404 });

    return new Response(JSON.stringify(user), { status: 200 });
  }

  // 2. ОБНОВИТЬ ПРОФИЛЬ (PUT)
  if (request.method === "PUT") {
    try {
      const data = await request.json();
      
      // ВАЖНО: В реальном проекте тут нужна проверка сессии, чтобы нельзя было менять чужой профиль!
      // Пока доверяем ID, который пришел с фронта (для прототипа).
      
      await db.prepare(`
        UPDATE users 
        SET car_model = ?, bio = ?
        WHERE id = ?
      `).bind(data.car_model, data.bio, data.id).run();

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}