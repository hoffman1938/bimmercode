// functions/api/user/notifications.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === 1. ПОЛУЧИТЬ УВЕДОМЛЕНИЯ (GET) ===
  if (request.method === "GET") {
    const userId = url.searchParams.get("user_id");
    if (!userId) return new Response("ID required", { status: 400 });

    try {
      // Берем последние 20 уведомлений
      const { results } = await db.prepare(`
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 20
      `).bind(userId).all();

      // Считаем сколько из них непрочитанных
      const unread = results.filter(n => !n.is_read).length;

      return new Response(JSON.stringify({ 
        notifications: results, 
        unread_count: unread 
      }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // === 2. ПОМЕТИТЬ КАК ПРОЧИТАННЫЕ (POST) ===
  if (request.method === "POST") {
    try {
      const { user_id } = await request.json();
      // Помечаем все уведомления этого юзера как прочитанные
      await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").bind(user_id).run();
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}