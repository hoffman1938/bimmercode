// functions/api/user/update.js

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Получаем данные от клиента
    const { id, avatar_url, bio, car_model } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 400,
      });
    }

    // Обновляем базу данных
    // COALESCE означает: "если новое значение null, оставь старое"
    await env.DB.prepare(
      `
      UPDATE users 
      SET 
        avatar_url = COALESCE(?, avatar_url), 
        bio = ?, 
        car_model = ? 
      WHERE id = ?
    `,
    )
      .bind(avatar_url, bio, car_model, id)
      .run();

    // Получаем обновленного пользователя, чтобы вернуть его на фронтенд
    const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first();

    return new Response(JSON.stringify({ success: true, user: updatedUser }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
