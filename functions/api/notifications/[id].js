export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const notificationId = params.id;

    if (!notificationId) {
        return new Response("Missing notification ID", { status: 400 });
    }

    try {
        const db = env.DB;
        await db.prepare("DELETE FROM notifications WHERE id = ?").bind(notificationId).run();

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
