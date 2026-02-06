export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const { user_id } = await request.json();

        if (!user_id) {
            return new Response("Missing user_id", { status: 400 });
        }

        const db = env.DB;
        await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").bind(user_id).run();

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
