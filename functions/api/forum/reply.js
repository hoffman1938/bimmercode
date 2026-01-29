// functions/api/forum/reply.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const data = await request.json();
    
    if (!data.topic_id || !data.content || !data.user_id) {
      return new Response("Missing fields", { status: 400 });
    }

    // Вставляем пост
    const result = await db.prepare(
      `INSERT INTO posts (topic_id, user_id, content, created_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(data.topic_id, data.user_id, data.content).run();

    if (!result.success) throw new Error("DB Error");

    // Обновляем статистику темы (кол-во ответов и дату последней активности)
    await db.prepare(
        `UPDATE topics 
         SET reply_count = reply_count + 1, last_activity_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
    ).bind(data.topic_id).run();

    return new Response(JSON.stringify({ success: true }), { status: 201 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}