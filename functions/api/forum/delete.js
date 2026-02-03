export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { type, id, user_id } = await request.json(); // type: 'topic' или 'post'

    if (type === "post") {
      // Проверяем владельца и удаляем пост
      const result = await env.DB.prepare(
        "DELETE FROM posts WHERE id = ? AND user_id = ?",
      )
        .bind(id, user_id)
        .run();
      if (result.meta.changes > 0)
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    if (type === "topic") {
      // Удаляем тему и все её посты
      await env.DB.prepare("DELETE FROM posts WHERE topic_id = ?")
        .bind(id)
        .run();
      const result = await env.DB.prepare(
        "DELETE FROM topics WHERE id = ? AND user_id = ?",
      )
        .bind(id, user_id)
        .run();
      if (result.meta.changes > 0)
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    return new Response(
      JSON.stringify({ error: "Access denied or not found" }),
      { status: 403 },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
