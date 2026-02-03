// functions/api/forum/edit.js

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { type, id, user_id, content } = await request.json();

    if (!content || !content.trim()) {
      return new Response(
        JSON.stringify({ error: "Content cannot be empty" }),
        { status: 400 },
      );
    }

    let result;

    if (type === "topic") {
      // Обновляем Тему
      // Проверяем, что user_id совпадает (безопасность)
      result = await env.DB.prepare(
        "UPDATE topics SET content = ? WHERE id = ? AND user_id = ?",
      )
        .bind(content, id, user_id)
        .run();
    } else {
      // Обновляем Пост (ответ)
      result = await env.DB.prepare(
        "UPDATE posts SET content = ? WHERE id = ? AND user_id = ?",
      )
        .bind(content, id, user_id)
        .run();
    }

    if (result.meta.changes > 0) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } else {
      return new Response(
        JSON.stringify({ error: "Update failed or access denied" }),
        { status: 403 },
      );
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
