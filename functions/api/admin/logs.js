// functions/api/admin/logs.js - Retrieve Audit Logs
import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequestGet(context) {
    const { request, env } = context;

    const auth = await authenticateAdminRequest(context);
    if (!auth.ok) return auth.response;

    try {
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
        const offset = parseInt(url.searchParams.get("offset")) || 0;
        const action = url.searchParams.get("action");
        const userId = url.searchParams.get("user_id");
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");

        let query = `
            SELECT l.*, u.username as actor_username 
            FROM audit_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (action) {
            query += " AND l.action = ?";
            params.push(action);
        }
        if (userId) {
            query += " AND l.user_id = ?";
            params.push(userId);
        }
        if (from) {
            query += " AND l.created_at >= ?";
            params.push(from);
        }
        if (to) {
            query += " AND l.created_at <= ?";
            params.push(to);
        }

        query += " ORDER BY l.created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const { results } = await env.DB.prepare(query).bind(...params).all();

        let countQuery = "SELECT COUNT(*) as total FROM audit_logs WHERE 1=1";
        const countParams = [];
        if (action) {
            countQuery += " AND action = ?";
            countParams.push(action);
        }
        if (userId) {
            countQuery += " AND user_id = ?";
            countParams.push(userId);
        }
        if (from) {
            countQuery += " AND created_at >= ?";
            countParams.push(from);
        }
        if (to) {
            countQuery += " AND created_at <= ?";
            countParams.push(to);
        }
        const totalRow = await env.DB.prepare(countQuery).bind(...countParams).first();

        return new Response(JSON.stringify({ 
            success: true, 
            logs: results,
            pagination: { total: totalRow?.total ?? 0, limit, offset }
        }), { 
            headers: { "Content-Type": "application/json" } 
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
