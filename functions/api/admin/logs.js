// functions/api/admin/logs.js - Retrieve Audit Logs
import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequestGet(context) {
    const { request, env } = context;

    const auth = await authenticateAdminRequest(context);
    if (!auth.ok) return auth.response;

    // Logic
    try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get("limit")) || 50;
        const offset = parseInt(url.searchParams.get("offset")) || 0;

        // Simple fetch
        // TODO: join with users table to get usernames
        const query = `
            SELECT l.*, u.username as actor_username 
            FROM audit_logs l
            LEFT JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC 
            LIMIT ? OFFSET ?
        `;
        
        const { results } = await env.DB.prepare(query).bind(limit, offset).all();

        return new Response(JSON.stringify({ 
            success: true, 
            logs: results 
        }), { 
            headers: { "Content-Type": "application/json" } 
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
