export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || "100", 10) || 100,
    200
  );
  const offset = parseInt(url.searchParams.get("offset") || "0", 10) || 0;
  const unreadOnly = url.searchParams.get("unread_only") === "1";

  if (!userId) {
    return new Response("Missing user_id", { status: 400 });
  }

  try {
    const db = env.DB;

    const where = unreadOnly ? "user_id = ? AND is_read = 0" : "user_id = ?";
    const { results } = await db
      .prepare(
        `SELECT id, user_id, type, title, text, link, icon, is_read, created_at, metadata
           FROM notifications
          WHERE ${where}
          ORDER BY datetime(created_at) DESC
          LIMIT ? OFFSET ?`
      )
      .bind(userId, limit, offset)
      .all();

    const unread = await db
      .prepare(
        `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`
      )
      .bind(userId)
      .first();

    return new Response(
      JSON.stringify({
        notifications: results || [],
        unread_count: Number(unread?.count || 0),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Expires: "0",
        },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
