// functions/api/forum/like.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { post_id, user_id } = await request.json();

    if (!post_id || !user_id) return new Response("Missing data", { status: 400 });

    // 1. Проверяем, стоит ли уже лайк
    const existing = await db.prepare(
      "SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?"
    ).bind(user_id, post_id).first();

    let liked = false;

    if (existing) {
      // Лайк есть -> УДАЛЯЕМ (Дизлайк)
      await db.prepare(
        "DELETE FROM post_likes WHERE user_id = ? AND post_id = ?"
      ).bind(user_id, post_id).run();
      liked = false;
    } else {
      // Лайка нет -> ДОБАВЛЯЕМ
      await db.prepare(
        "INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)"
      ).bind(user_id, post_id).run();
      liked = true;
    }

    // 2. Получаем новое количество лайков
    const countResult = await db.prepare(
      "SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?"
    ).bind(post_id).first();

    return new Response(JSON.stringify({ 
      success: true, 
      liked: liked, 
      count: countResult.count 
    }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}