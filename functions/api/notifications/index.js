export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id"); // Ideally get from auth token, but for now query param matches existing patterns
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    if (!userId) {
        return new Response("Missing user_id", { status: 400 });
    }

    try {
        const db = env.DB;

        // Fetch notifications
        const { results } = await db.prepare(`
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).bind(userId, limit, offset).all();

        // Count unread
        const unread = await db.prepare(`
            SELECT COUNT(*) as count FROM notifications 
            WHERE user_id = ? AND is_read = 0
        `).bind(userId).first();

        return new Response(JSON.stringify({
            notifications: results,
            unread_count: unread.count
        }), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                "Expires": "0"
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
