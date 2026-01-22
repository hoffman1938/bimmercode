export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { post_id, user_id } = await request.json();
    if (!post_id || !user_id) return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });

    const existing = await db.prepare("SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?").bind(user_id, post_id).first();
    let liked = false;

    if (existing) {
      await db.prepare("DELETE FROM post_likes WHERE user_id = ? AND post_id = ?").bind(user_id, post_id).run();
    } else {
      await db.prepare("INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)").bind(user_id, post_id).run();
      liked = true;

      // --- СОЗДАНИЕ УВЕДОМЛЕНИЯ О ЛАЙКЕ ---
      const postInfo = await db.prepare(`
        SELECT p.user_id, t.id as topic_id, t.title 
        FROM posts p JOIN topics t ON p.topic_id = t.id WHERE p.id = ?
      `).bind(post_id).first();

      if (postInfo && postInfo.user_id !== parseInt(user_id)) {
         // Получаем имя отправителя
         const sender = await db.prepare("SELECT username FROM users WHERE id = ?").bind(user_id).first();
         const senderName = sender ? sender.username : "User";

         await db.prepare(`
          INSERT INTO notifications (user_id, sender_id, sender_name, type, topic_id, topic_title)
          VALUES (?, ?, ?, 'like', ?, ?)
        `).bind(postInfo.user_id, user_id, senderName, postInfo.topic_id, postInfo.title).run();
      }
    }

    const countResult = await db.prepare("SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?").bind(post_id).first();
    return new Response(JSON.stringify({ success: true, liked: liked, count: countResult.count }), { status: 200 });

  } catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}