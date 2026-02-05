export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { type, id, user_id } = await request.json(); // type: 'topic' или 'post'

    // Check user role
    const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(user_id).first();
    const isAdmin = user && user.role === 'admin';

    if (type === "post") {
      let query = "DELETE FROM posts WHERE id = ?";
      const params = [id];
      
      // If not admin, enforce ownership
      if (!isAdmin) {
          query += " AND user_id = ?";
          params.push(user_id);
      }

      const result = await env.DB.prepare(query).bind(...params).run();
      
      if (result.meta.changes > 0)
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    if (type === "topic") {
      // Check ownership first if not admin
      if (!isAdmin) {
         const topic = await env.DB.prepare("SELECT user_id FROM topics WHERE id = ?").bind(id).first();
         if (!topic || topic.user_id !== user_id) {
             return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
         }
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
