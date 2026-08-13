// functions/api/admin/unban.js - Unban User API
import { authenticateAdminRequest } from "../../lib/admin-gate.js";
import { logAudit } from "../../lib/audit.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const adminId = auth.userId;

  try {
    const { user_id, reason } = await request.json();

    if (!user_id) return new Response("Missing user_id", { status: 400 });

    await env.DB.prepare("UPDATE users SET is_active = 1 WHERE id = ?").bind(user_id).run();
    try {
      await env.DB.prepare(
        `UPDATE user_bans SET lifted_at = CURRENT_TIMESTAMP, lifted_by = ?
         WHERE user_id = ? AND lifted_at IS NULL`
      ).bind(adminId, user_id).run();
    } catch (_) { /* table optional */ }
    
    // Log
    await logAudit(env, {
        userId: adminId,
        action: "user_unbanned",
        targetEntityType: "user",
        targetEntityId: user_id,
        targetUserId: user_id,
        details: { reason },
        ipAddress: request.headers.get("CF-Connecting-IP") || "127.0.0.1",
        userAgent: request.headers.get("User-Agent")
    });

    return new Response(JSON.stringify({ success: true, message: "User unbanned" }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
