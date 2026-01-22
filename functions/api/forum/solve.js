// functions/api/forum/solve.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { topic_id, post_id, user_id } = await request.json();

    if (!topic_id || !post_id || !user_id) return new Response("Missing data", { status: 400 });

    // 1. Проверяем, является ли user_id автором темы
    const topic = await db.prepare("SELECT user_id FROM topics WHERE id = ?").bind(topic_id).first();
    
    if (!topic) return new Response("Topic not found", { status: 404 });
    
    // Только автор темы (или админ) может выбирать решение
    // В реальном проекте добавьте проверку на админа, если нужно
    if (topic.user_id !== parseInt(user_id)) {
        return new Response("Only topic author can mark solution", { status: 403 });
    }

    // 2. Сбрасываем предыдущее решение в этой теме (если было)
    await db.prepare("UPDATE posts SET is_solution = 0 WHERE topic_id = ?").bind(topic_id).run();

    // 3. Ставим новое решение
    await db.prepare("UPDATE posts SET is_solution = 1 WHERE id = ?").bind(post_id).run();

    // 4. Помечаем тему как решенную
    await db.prepare("UPDATE topics SET is_solved = 1 WHERE id = ?").bind(topic_id).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}