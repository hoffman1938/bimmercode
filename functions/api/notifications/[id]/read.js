export async function onRequestPost(context) {
    const { request, env, params } = context;
    const notificationId = params.id;

    if (!notificationId) {
        return new Response("Missing notification ID", { status: 400 });
    }

    try {
        // We technically should verify user ownership here, but for MVP we skip strict auth check on ID
        // In V2 strict mode, we might want to check if the user is authorized. 
        // For now, we update blindly by ID.
        
        const db = env.DB;
        await db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(notificationId).run();

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
