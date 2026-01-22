export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { topic_id, post_id, user_id } = await request.json();
    if (!topic_id || !post_id || !user_id) return new Response("Missing data", { status: 400 });

    // Проверка прав (автор темы)
    const topic = await db.prepare("SELECT user_id, title FROM topics WHERE id = ?").bind(topic_id).first();
    if (!topic || topic.user_id !== parseInt(user_id)) return new Response("Forbidden", { status: 403 });

    // Логика решения
    await db.prepare("UPDATE posts SET is_solution = 0 WHERE topic_id = ?").bind(topic_id).run();
    await db.prepare("UPDATE posts SET is_solution = 1 WHERE id = ?").bind(post_id).run();
    await db.prepare("UPDATE topics SET is_solved = 1 WHERE id = ?").bind(topic_id).run();

    // Уведомление автору решения
    const post = await db.prepare("SELECT user_id FROM posts WHERE id = ?").bind(post_id).first();
    const sender = await db.prepare("SELECT username FROM users WHERE id = ?").bind(user_id).first();
    
    if (post && post.user_id !== parseInt(user_id)) {
      await db.prepare(`
        INSERT INTO notifications (user_id, sender_id, sender_name, type, topic_id, topic_title)
        VALUES (?, ?, ?, 'solve', ?, ?)
      `).bind(post.user_id, user_id, sender.username, topic_id, topic.title).run();
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}