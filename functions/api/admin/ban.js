// functions/api/admin/ban.js - Ban User API (Protected)
import { verifyToken } from "../../lib/jwt.js";
import { requirePermission } from "../../lib/permissions.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";
import { getIpAddress } from "../../lib/rate-limit.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // 1. Authenticate
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  
  const token = authHeader.split(" ")[1];
  const secret = env.JWT_SECRET || "secret-dev-key";
  const decoded = await verifyToken(token, secret);
  
  if (!decoded) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401 });
  }
  
  const adminId = decoded.id;
  
  // 2. Authorization (RBAC)
  const checkPermission = requirePermission('ban_user'); // Requires 'ban_user' permission
  const errorResponse = await checkPermission(context, adminId);
  if (errorResponse) return errorResponse;
  
  // 3. Logic: Ban User
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
      
      // Execute Ban (Set is_active = 0)
      // Or in a real system, we might have a `banned_until` column. 
      // For now, let's just use `is_active = 0` (permanent ban) or maybe add a `ban_reason` field if strictly needed.
      // Let's assume permanent ban for now based on 'ban_user' permission. 
      // 'temp_ban_user' would use duration.
      
      await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?").bind(user_id).run();
      
      // 4. Audit Log
      await logAudit(env, {
          userId: adminId,
          action: AUDIT_ACTIONS.USER_BANNED,
          targetEntityType: 'user',
          targetEntityId: user_id,
          targetUserId: user_id,
          details: { reason, duration: 'permanent' },
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
