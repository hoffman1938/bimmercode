// functions/api/admin/ban.js - Ban User API (Protected)
import { authenticateAdminRequest } from "../../lib/admin-gate.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";
import { getIpAddress } from "../../lib/rate-limit.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const adminId = auth.userId;

  // Logic: Ban User
  try {
      const { user_id, reason, duration_hours } = await request.json();
      
      if (!user_id || !reason) {
          return new Response(JSON.stringify({ error: "User ID and reason required" }), { status: 400 });
      }
      
      // Prevent self-ban
      if (user_id === adminId) {
          return new Response(JSON.stringify({ error: "Cannot ban yourself" }), { status: 400 });
      }
      
      // Check target user exists
      const targetUser = await env.DB.prepare("SELECT role_id FROM users WHERE id = ?").bind(user_id).first();
      if (!targetUser) {
          return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
      }
      
      // Optional: Prevent banning higher roles (e.g. Moderator cannot ban Admin)
      const adminRole = await env.DB.prepare("SELECT level FROM roles WHERE id = (SELECT role_id FROM users WHERE id = ?)").bind(adminId).first();
      const targetRole = await env.DB.prepare("SELECT level FROM roles WHERE id = ?").bind(targetUser.role_id).first();
      
      if (targetRole && adminRole && targetRole.level >= adminRole.level) {
           return new Response(JSON.stringify({ error: "Cannot ban user with equal or higher role" }), { status: 403 });
      }
      
      let expiresAt = null;
      const durationLabel =
        duration_hours && Number(duration_hours) > 0
          ? `${duration_hours}h`
          : "permanent";
      if (duration_hours && Number(duration_hours) > 0) {
        expiresAt = new Date(
          Date.now() + Number(duration_hours) * 3600000
        ).toISOString();
      }

      const banId = crypto.randomUUID();
      try {
        await env.DB.prepare(
          `INSERT INTO user_bans (id, user_id, issued_by, reason, expires_at)
           VALUES (?, ?, ?, ?, ?)`
        )
          .bind(banId, user_id, adminId, reason, expiresAt)
          .run();
      } catch (e) {
        console.warn("[ban] user_bans insert skipped", e.message);
      }

      await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?")
        .bind(user_id)
        .run();

      await logAudit(env, {
          userId: adminId,
          action: AUDIT_ACTIONS.USER_BANNED,
          targetEntityType: 'user',
          targetEntityId: user_id,
          targetUserId: user_id,
          details: { reason, duration: durationLabel, expires_at: expiresAt, ban_id: banId },
          ipAddress: getIpAddress(request)
      });
      
      return new Response(JSON.stringify({ success: true, message: "User banned successfully" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
      });
      
  } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
