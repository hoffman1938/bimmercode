// functions/api/admin/logs.js - Retrieve Audit Logs
import { verifyToken } from "../../lib/jwt.js";
import { requirePermission } from "../../lib/permissions.js";

export async function onRequestGet(context) {
    const { request, env } = context;

    // 1. Authenticate
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
    if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });

    const userId = decoded.id;

    // 2. Permission Check
    const checkPermission = requirePermission('view_audit_logs'); // Ensure this permission exists or use generic
    // Use 'view_user_details' if 'view_audit_logs' not seeded, but I think I seeded it?
    // Let's use 'view_user_details' as fallback or 'admin_role' check logic if needed. 
    // Actually, 'view_audit_logs' WAS in the seed list earlier.
    const authError = await checkPermission(context, userId);
    if (authError) return authError;

    // 3. Logic
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
