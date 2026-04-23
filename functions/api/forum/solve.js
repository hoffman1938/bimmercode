// functions/api/forum/solve.js
// Toggle is_solution on a post. Topic author only. Multiple posts can be solutions.
// +10 / −10 reputation when marking / unmarking (not when OP marks their own post).

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { topic_id, post_id, user_id, set_solution } = await request.json();
    if (!topic_id || !post_id || !user_id)
      return new Response("Missing data", { status: 400 });

    const topic = await db
      .prepare("SELECT user_id, title, id FROM topics WHERE id = ?")
      .bind(topic_id)
      .first();

    if (!topic || String(topic.user_id) !== String(user_id)) {
      return json({ error: "Only topic author can mark solution" }, 403);
    }

    const post = await db
      .prepare("SELECT id, topic_id, user_id, is_solution FROM posts WHERE id = ?")
      .bind(post_id)
      .first();

    if (!post || String(post.topic_id) !== String(topic_id)) {
      return json({ error: "Post not in this topic" }, 400);
    }

    const wasSolution = Number(post.is_solution) === 1;
    const otherUser = String(post.user_id) !== String(user_id);

    /** true = mark, false = unmark, undefined/legacy = toggle */
    const wantMark =
      typeof set_solution === "boolean" ? set_solution : !wasSolution;

    if (wantMark === wasSolution) {
      return json({ success: true, is_solution: wasSolution, no_op: true });
    }

    if (wantMark) {
      await db
        .prepare("UPDATE posts SET is_solution = 1 WHERE id = ?")
        .bind(post_id)
        .run();
      await db
        .prepare("UPDATE topics SET is_solved = 1 WHERE id = ?")
        .bind(topic_id)
        .run();

      if (otherUser) {
        await db
          .prepare(
            "UPDATE users SET reputation = COALESCE(reputation, 0) + 10 WHERE id = ?"
          )
          .bind(post.user_id)
          .run();

        const sender = await db
          .prepare("SELECT username FROM users WHERE id = ?")
          .bind(user_id)
          .first();

        const metadata = JSON.stringify({
          sender_id: user_id,
          sender_name: sender?.username,
          topic_id: topic_id,
          post_id: post_id,
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
            (sender?.username || "Someone") + " marked your post as solution",
            `/topic?id=${topic_id}#post-${post_id}`,
            metadata,
          )
          .run();
      }

      return json({ success: true, is_solution: true });
    }

    // Unmark
    await db
      .prepare("UPDATE posts SET is_solution = 0 WHERE id = ?")
      .bind(post_id)
      .run();

    if (otherUser) {
      await db
        .prepare(
          `UPDATE users SET reputation =
             CASE WHEN COALESCE(reputation, 0) >= 10 THEN COALESCE(reputation, 0) - 10 ELSE 0 END
           WHERE id = ?`
        )
        .bind(post.user_id)
        .run();
    }

    const { c } = (await db
      .prepare(
        "SELECT COUNT(*) AS c FROM posts WHERE topic_id = ? AND is_solution = 1"
      )
      .bind(topic_id)
      .first()) || { c: 0 };

    if (Number(c) === 0) {
      await db
        .prepare("UPDATE topics SET is_solved = 0 WHERE id = ?")
        .bind(topic_id)
        .run();
    }

    return json({ success: true, is_solution: false });
  } catch (e) {
    return json({ error: e.message || String(e) }, 500);
  }
}
