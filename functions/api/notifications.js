// functions/api/notifications.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === GET: Получить список уведомлений ===
  if (request.method === "GET") {
    const userId = url.searchParams.get("user_id");
    if (!userId) return new Response("Missing user_id", { status: 400 });

    try {
      // Берем последние 20 уведомлений
      // (D1 возвращает 0/1 для boolean, поэтому конвертация не нужна, JS поймет)
      const { results } = await db
        .prepare(
          `
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 20
      `,
        )
        .bind(userId)
        .all();

      // Считаем количество непрочитанных
      const unread = results.filter((n) => !n.is_read).length;

      return new Response(
        JSON.stringify({
          notifications: results,
          unread_count: unread,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
      });
    }
  }

  // === POST: Отметить как прочитанное ===
  if (request.method === "POST") {
    try {
      const { user_id } = await request.json();
      // Отмечаем все уведомления этого юзера как прочитанные
      await db
        .prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?")
        .bind(user_id)
        .run();
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
