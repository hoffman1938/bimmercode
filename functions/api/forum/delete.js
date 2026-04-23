export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { type, id, user_id } = await request.json(); // type: 'topic' или 'post'

    // Check user role
    const user = await env.DB.prepare("SELECT role_id FROM users WHERE id = ?").bind(user_id).first();
    const isAdmin = user && (user.role_id === 'admin_role' || user.role_id === 'super_admin_role');

    if (type === "post") {
      const post = await env.DB
        .prepare("SELECT user_id, topic_id FROM posts WHERE id = ?")
        .bind(id)
        .first();

      if (!post) {
        return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 });
      }

      // Mirror row for topic body: id === topic_id — remove thread via type "topic", not as a single post
      if (String(post.id) === String(post.topic_id)) {
        return new Response(
          JSON.stringify({ error: "Delete the whole topic to remove the opening post" }),
          { status: 400 },
        );
      }

      let mayDelete = !!isAdmin;
      if (!mayDelete) {
        if (post.user_id === user_id) {
          mayDelete = true;
        } else {
          const topic = await env.DB
            .prepare("SELECT user_id FROM topics WHERE id = ?")
            .bind(post.topic_id)
            .first();
          if (topic && topic.user_id === user_id) {
            mayDelete = true; // topic author may remove any reply in their thread
          }
        }
      }

      if (!mayDelete) {
        return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
      }

      // Reactions reference posts (FK) — must remove first
      await env.DB.prepare("DELETE FROM reactions WHERE post_id = ?").bind(id).run();
      try {
        await env.DB.prepare("DELETE FROM post_likes WHERE post_id = ?").bind(id).run();
      } catch {
        /* table may be absent in some envs */
      }

      const result = await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();

      if (result.meta.changes > 0) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
    }

    if (type === "topic") {
      // Check ownership first if not admin
      if (!isAdmin) {
         const topic = await env.DB.prepare("SELECT user_id FROM topics WHERE id = ?").bind(id).first();
         if (!topic || topic.user_id !== user_id) {
             return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
         }
      }

      // Reactions and posts: clear FK children before posts
      await env.DB
        .prepare("DELETE FROM reactions WHERE post_id IN (SELECT id FROM posts WHERE topic_id = ?)")
        .bind(id)
        .run();
      try {
        await env.DB
          .prepare("DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE topic_id = ?)")
          .bind(id)
          .run();
      } catch {
        /* optional table */
      }

      // Delete topic and its posts
      await env.DB.prepare("DELETE FROM posts WHERE topic_id = ?").bind(id).run();
      const result = await env.DB.prepare("DELETE FROM topics WHERE id = ?").bind(id).run();

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
