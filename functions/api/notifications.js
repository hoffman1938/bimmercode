// functions/api/notifications.js

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return new Response(JSON.stringify({ error: "user_id required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Получаем последние 30 уведомлений для пользователя
    const { results } = await db
      .prepare(
        `SELECT * FROM notifications 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT 30`,
      )
      .bind(userId)
      .all();

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// POST: Отметить уведомления как прочитанные
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { user_id, notification_ids } = await request.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (notification_ids && notification_ids.length > 0) {
      // Отмечаем конкретные уведомления
      const placeholders = notification_ids.map(() => "?").join(",");
      await db
        .prepare(
          `UPDATE notifications SET is_read = 1 
           WHERE user_id = ? AND id IN (${placeholders})`,
        )
        .bind(user_id, ...notification_ids)
        .run();
    } else {
      // Отмечаем все уведомления пользователя как прочитанные
      await db
        .prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?")
        .bind(user_id)
        .run();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
