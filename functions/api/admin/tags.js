// functions/api/admin/tags.js - Manage Forum Tags
import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequest(context) {
    const { request, env } = context;

    const auth = await authenticateAdminRequest(context);
    if (!auth.ok) return auth.response;

    if (request.method === 'GET') return handleGet(context);
    if (request.method === 'POST') return handlePost(context);
    if (request.method === 'DELETE') return handleDelete(context);

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

async function handleGet(context) {
    try {
        const { results } = await context.env.DB.prepare("SELECT * FROM tags ORDER BY name ASC").all();
        return new Response(JSON.stringify({ success: true, tags: results }), { headers: { "Content-Type": "application/json" }});
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

async function handlePost(context) {
    try {
        const { name, color } = await context.request.json();
        if (!name) return new Response(JSON.stringify({ error: "Name required" }), { status: 400 });

        const id = crypto.randomUUID();
        await context.env.DB.prepare("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)").bind(id, name, color || '#3498db').run();

        return new Response(JSON.stringify({ success: true, tag: { id, name, color } }), { headers: { "Content-Type": "application/json" }});
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

async function handleDelete(context) {
    try {
        const { id } = await context.request.json();
        if (!id) return new Response(JSON.stringify({ error: "ID required" }), { status: 400 });

        await context.env.DB.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
        // Clean up junction table
        await context.env.DB.prepare("DELETE FROM topic_tags WHERE tag_id = ?").bind(id).run();

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" }});
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
