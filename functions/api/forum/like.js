// functions/api/forum/like.js
import { insertNotificationIfAllowed } from "../../lib/forum-notifications.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { post_id, user_id } = await request.json();
    if (!post_id || !user_id)
      return new Response(JSON.stringify({ error: "Missing data" }), {
        status: 400,
      });

    // 1. Проверяем, стоит ли уже лайк
    const existing = await db
      .prepare("SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?")
      .bind(user_id, post_id)
      .first();
    let liked = false;

    if (existing) {
      // Убираем лайк (Unlike)
      await db
        .prepare("DELETE FROM post_likes WHERE user_id = ? AND post_id = ?")
        .bind(user_id, post_id)
        .run();
        
      // REPUTATION: -1 point
       const postInfo = await db.prepare("SELECT user_id FROM posts WHERE id = ?").bind(post_id).first();
       if (postInfo && String(postInfo.user_id) !== String(user_id)) {
           await db.prepare("UPDATE users SET reputation = MAX(0, COALESCE(reputation, 0) - 1) WHERE id = ?")
             .bind(postInfo.user_id)
             .run();
       }

    } else {
      // Ставим лайк (Like)
      await db
        .prepare("INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)")
        .bind(user_id, post_id)
        .run();
      liked = true;

      // 2. ОТПРАВЛЯЕМ УВЕДОМЛЕНИЕ (если лайкнули не свой пост)
      // Сначала узнаем, чей это пост
      const post = await db
        .prepare(
          "SELECT p.user_id, t.id as topic_id, t.title FROM posts p JOIN topics t ON p.topic_id = t.id WHERE p.id = ?",
        )
        .bind(post_id)
        .first();
      // Получаем имя лайкнувшего
      const sender = await db
        .prepare("SELECT username FROM users WHERE id = ?")
        .bind(user_id)
        .first();
      const senderName = sender ? sender.username : "User";

      if (
        post &&
        String(post.user_id) !== String(user_id)
      ) {
        
        // REPUTATION: +1 point
        await db.prepare("UPDATE users SET reputation = COALESCE(reputation, 0) + 1 WHERE id = ?")
            .bind(post.user_id)
            .run();

        await insertNotificationIfAllowed(db, {
          toUserId: post.user_id,
          fromUserId: user_id,
          topicId: post.topic_id,
          type: "like",
          title: "New like",
          text: senderName + " liked your post",
          link: `/topic?id=${post.topic_id}#post-${post_id}`,
          icon: "fa-heart",
          metadata: {
            sender_id: user_id,
            sender_name: senderName,
            topic_id: post.topic_id,
            post_id,
          },
        });
      }
    }

    // Возвращаем новое количество лайков
    const countResult = await db
      .prepare("SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?")
      .bind(post_id)
      .first();

    return new Response(
      JSON.stringify({ success: true, liked, count: countResult.count }),
      { status: 200 },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
