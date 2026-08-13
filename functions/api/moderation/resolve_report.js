// functions/api/moderation/reports/resolve.js - Resolve Report API
import { verifyToken } from "../../lib/jwt.js";
import { hasPermission } from "../../lib/permissions.js";
import { logAudit } from "../../lib/audit.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response("Invalid token", { status: 401 });

  const moderatorId = decoded.id;
  const allowed = await hasPermission(env, moderatorId, "resolve_reports");
  if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const { report_id, status, notes } = await request.json(); // status: 'resolved' or 'dismissed'

    if (!report_id || !status) return new Response("Missing fields", { status: 400 });

    await env.DB.prepare(`
        UPDATE reports 
        SET status = ?, moderator_id = ?, resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(status, moderatorId, notes, report_id).run();
    
    // Log
    await logAudit(env, {
        userId: moderatorId,
        action: "report_resolved",
        targetEntityType: "report",
        targetEntityId: report_id,
        details: { status, notes },
        ipAddress: "127.0.0.1",
        userAgent: "API"
    });

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
