// functions/api/moderation/reports/list.js - List Reports API
import { verifyToken } from "../../lib/jwt.js";
import { hasPermission } from "../../lib/permissions.js";

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

  // 2. Permission Check
  const allowed = await hasPermission(env, decoded.id, "view_reports");
  if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "pending";
    const limit = url.searchParams.get("limit") || 20;
    const offset = url.searchParams.get("offset") || 0;

    const results = await env.DB.prepare(`
        SELECT reports.*, 
               reporter.username as reporter_username,
               reported.username as reported_username
        FROM reports
        LEFT JOIN users as reporter ON reports.reporter_id = reporter.id
        LEFT JOIN users as reported ON reports.reported_user_id = reported.id
        WHERE status = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all();

    return new Response(JSON.stringify({ success: true, reports: results.results }), {
        headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
