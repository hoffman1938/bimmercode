// functions/api/forum/solve.js

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { topic_id, post_id, user_id } = await request.json();
    if (!topic_id || !post_id || !user_id)
      return new Response("Missing data", { status: 400 });

    // 1. Проверка прав (Только автор темы может выбрать решение)
    const topic = await db
      .prepare("SELECT user_id, title FROM topics WHERE id = ?")
      .bind(topic_id)
      .first();

    // Сравниваем ID (приводим к строкам на всякий случай)
    if (!topic || String(topic.user_id) !== String(user_id)) {
      return new Response(
        JSON.stringify({ error: "Only topic author can mark solution" }),
        { status: 403 },
      );
    }

    // 2. Логика решения (Транзакция)
    // а) Снимаем галочку 'solution' со всех постов в этой теме (вдруг передумал)
    await db
      .prepare("UPDATE posts SET is_solution = 0 WHERE topic_id = ?")
      .bind(topic_id)
      .run();

    // б) Ставим галочку новому посту
    await db
      .prepare("UPDATE posts SET is_solution = 1 WHERE id = ?")
      .bind(post_id)
      .run();

    // в) Отмечаем тему как "Решено"
    await db
      .prepare("UPDATE topics SET is_solved = 1 WHERE id = ?")
      .bind(topic_id)
      .run();

    // 3. Уведомление автору решения
    const post = await db
      .prepare("SELECT user_id FROM posts WHERE id = ?")
      .bind(post_id)
      .first();
    const sender = await db
      .prepare("SELECT username FROM users WHERE id = ?")
      .bind(user_id)
      .first();

    // 3. REPUTATION: +10 points to solution author
    if (post && String(post.user_id) !== String(user_id)) {
        await db.prepare("UPDATE users SET reputation = COALESCE(reputation, 0) + 10 WHERE id = ?")
            .bind(post.user_id)
            .run();
    }

    if (post && String(post.user_id) !== String(user_id)) {
        const metadata = JSON.stringify({
            sender_id: user_id,
            sender_name: sender.username,
            topic_id: topic_id,
            post_id: post_id
        });

      await db
        .prepare(
          `
        INSERT INTO notifications (id, user_id, type, title, text, link, icon, metadata)
        VALUES (?, ?, 'solve', ?, ?, ?, 'fa-check-circle', ?)
      `,
        )
        .bind(
          crypto.randomUUID(),
          post.user_id,
          "Solution marked",
          sender.username + " marked your post as solution",
          `/topic?id=${topic_id}#post-${post_id}`,
          metadata
        )
        .run();
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
