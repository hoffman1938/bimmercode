// functions/api/forum/topics.js

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  // === GET: Получить список тем ===
  if (request.method === "GET") {
    try {
      const category = url.searchParams.get("category");
      const search = url.searchParams.get("search");

      let query = `
        SELECT t.*, COUNT(p.id) as reply_count 
        FROM topics t 
        LEFT JOIN posts p ON p.topic_id = t.id 
      `;

      const params = [];
      const conditions = [];

      if (category && category !== "all") {
        conditions.push("t.category = ?");
        params.push(category);
      }

      if (search) {
        conditions.push("(t.title LIKE ? OR t.content LIKE ?)");
        params.push(`%${search}%`);
        params.push(`%${search}%`);
      }

      // Filter by User ID (for Profile Page)
      const userId = url.searchParams.get("user_id");
      if (userId) {
        conditions.push("t.user_id = ?");
        params.push(userId);
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " GROUP BY t.id ORDER BY t.created_at DESC";

      const stmt = db.prepare(query).bind(...params);
      const { results } = await stmt.all();

      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
      });
    }
  }

  // === POST: Создать тему ===
  if (request.method === "POST") {
    try {
      const data = await request.json();

      if (!data.title || !data.content || !data.user_id) {
        return new Response(JSON.stringify({ error: "Missing fields: " + JSON.stringify(data) }), {
          status: 400,
        });
      }

      // Generate UUID (polyfill-ish)
      const topicId = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
      });

      await db
        .prepare(
          "INSERT INTO topics (id, user_id, username, category, title, content, related_code, lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          topicId,
          data.user_id,
          data.username,
          data.category || "general",
          data.title,
          data.content,
          data.related_code || null,
          data.lang || "en",
        )
        .run();

      return new Response(JSON.stringify({ success: true, topicId }), {
        status: 201,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
