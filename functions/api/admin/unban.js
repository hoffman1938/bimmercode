// functions/api/admin/unban.js - Unban User API
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

  const adminId = decoded.id;
  const allowed = await hasPermission(env, adminId, "ban_user"); // Reusing ban permission for unban
  if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const { user_id, reason } = await request.json();

    if (!user_id) return new Response("Missing user_id", { status: 400 });

    await env.DB.prepare("UPDATE users SET is_active = 1 WHERE id = ?").bind(user_id).run();
    
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
