// functions/api/admin/categories.js - Manage Forum Categories
import { authenticateAdminRequest } from "../../lib/admin-gate.js";

// Helper to slugify title
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

export async function onRequest(context) {
    const { request, env } = context;

    const auth = await authenticateAdminRequest(context);
    if (!auth.ok) return auth.response;

    // Handle Methods
    if (request.method === 'GET') {
        return handleGet(context);
    } else if (request.method === 'POST') {
        return handlePost(context);
    } else if (request.method === 'PUT') {
        return handlePut(context);
    } else if (request.method === 'DELETE') {
        return handleDelete(context);
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

// GET: List all categories
async function handleGet(context) {
    const { env } = context;
    try {
        const { results } = await env.DB.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all();
        return new Response(JSON.stringify({ success: true, categories: results }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// POST: Create category
async function handlePost(context) {
    const { request, env } = context;
    try {
        const data = await request.json();
        const { title, description, icon, sort_order, min_role_read, min_role_write } = data;
        
        if (!title) {
            return new Response(JSON.stringify({ error: "Title is required" }), { status: 400 });
        }

        const id = crypto.randomUUID();
        const slug = slugify(title);

        await env.DB.prepare(`
            INSERT INTO categories (id, slug, title, description, icon, sort_order, min_role_read, min_role_write)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id, slug, title, description, icon || 'fas fa-folder', 
            sort_order || 0, min_role_read || 'user_role', min_role_write || 'user_role'
        ).run();

        await logAudit(env, context.userId, 'category_created', 'category', id, { title });

        return new Response(JSON.stringify({ success: true, category_id: id }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// PUT: Update category
async function handlePut(context) {
    const { request, env } = context;
    try {
        const data = await request.json();
        const { id, title, description, icon, sort_order, is_active, min_role_read, min_role_write,
          is_hidden, is_private, is_vip, is_archived, reorder } = data;

        if (reorder && Array.isArray(reorder)) {
            for (let i = 0; i < reorder.length; i++) {
                await env.DB.prepare("UPDATE categories SET sort_order = ? WHERE id = ?")
                    .bind(i, reorder[i])
                    .run();
            }
            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" }});
        }
        
        if (!id) return new Response(JSON.stringify({ error: "ID required" }), { status: 400 });

        let query = "UPDATE categories SET ";
        let params = [];
        let updates = [];

        if (title) { updates.push("title = ?"); params.push(title); updates.push("slug = ?"); params.push(slugify(title)); }
        if (description !== undefined) { updates.push("description = ?"); params.push(description); }
        if (icon) { updates.push("icon = ?"); params.push(icon); }
        if (sort_order !== undefined) { updates.push("sort_order = ?"); params.push(sort_order); }
        if (is_active !== undefined) { updates.push("is_active = ?"); params.push(is_active); }
        if (min_role_read) { updates.push("min_role_read = ?"); params.push(min_role_read); }
        if (min_role_write) { updates.push("min_role_write = ?"); params.push(min_role_write); }
        if (is_hidden !== undefined) { updates.push("is_hidden = ?"); params.push(is_hidden ? 1 : 0); }
        if (is_private !== undefined) { updates.push("is_private = ?"); params.push(is_private ? 1 : 0); }
        if (is_vip !== undefined) { updates.push("is_vip = ?"); params.push(is_vip ? 1 : 0); }
        if (is_archived !== undefined) { updates.push("is_archived = ?"); params.push(is_archived ? 1 : 0); }

        if (updates.length === 0) return new Response(JSON.stringify({ error: "No fields to update" }), { status: 400 });

        query += updates.join(", ") + " WHERE id = ?";
        params.push(id);

        await env.DB.prepare(query).bind(...params).run();

        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" }});
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// DELETE: Delete category
async function handleDelete(context) {
    const { request, env } = context;
    try {
        const { id } = await request.json();
        if (!id) return new Response(JSON.stringify({ error: "ID required" }), { status: 400 });

        // Check for topics in this category? 
        // For now, let's assume we can clean them up or block deletion.
        // Blocking is safer.
        const topicCount = await env.DB.prepare("SELECT COUNT(*) as count FROM topics WHERE category = (SELECT slug FROM categories WHERE id = ?)").bind(id).first('count');
        
        if (topicCount > 0) {
            return new Response(JSON.stringify({ error: "Cannot delete category with existing topics" }), { status: 400 });
        }

        await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
        
        return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" }});
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

async function logAudit(env, userId, action, type, targetId, details) {
    try {
        await env.DB.prepare(
            "INSERT INTO audit_logs (id, user_id, action, target_entity_type, target_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(crypto.randomUUID(), userId || 'system', action, type, targetId, JSON.stringify(details)).run();
    } catch (e) {
        console.error("Audit Log Error:", e);
    }
}
