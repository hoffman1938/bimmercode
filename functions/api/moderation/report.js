// functions/api/moderation/report.js - Submit Report API
import { verifyToken } from "../../lib/jwt.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Authenticate (Any logged-in user can report)
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  
  const reporterId = decoded.id;

  try {
    const { entity_type, entity_id, reason, description, reported_user_id } = await request.json();

    if (!entity_type || !entity_id || !reason) {
        return new Response(JSON.stringify({ error: "Missing required fields: entity_type, entity_id, reason" }), { status: 400 });
    }

    // 2. Submit Report
    const reportId = crypto.randomUUID();
    
    await env.DB.prepare(`
        INSERT INTO reports (id, reporter_id, reported_entity_type, reported_entity_id, reported_user_id, reason, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(reportId, reporterId, entity_type, entity_id, reported_user_id || null, reason, description || null).run();

    return new Response(JSON.stringify({ success: true, message: "Report submitted successfully", report_id: reportId }), {
        headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
