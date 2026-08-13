// functions/api/admin/roles/assign.js - Assign User Roles
import { authenticateAdminRequest } from "../../../lib/admin-gate.js";
import { getUserRole } from "../../../lib/permissions.js";
import { validateRoleChange } from "../../../lib/role-assign.js";

/** Comma/semicolon emails — allow admin (non-super) to grant super_admin_role only to these accounts (bootstrap). */
function emailInList(env, email, varName) {
  const raw = env[varName];
  if (!email || !raw) return false;
  const e = String(email).trim().toLowerCase();
  return String(raw)
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(e);
}

export async function onRequestPost(context) {
    const { request, env } = context;

    const auth = await authenticateAdminRequest(context);
    if (!auth.ok) return auth.response;
    const adminId = auth.userId;

    // Logic
    try {
        const { user_id, role_id, reason } = await request.json();

        if (!user_id || !role_id) {
            return new Response(JSON.stringify({ error: "User ID and Role ID are required" }), { status: 400 });
        }

        const adminRole = await getUserRole(env, adminId);
        const targetRoleParams = await env.DB.prepare("SELECT level, name FROM roles WHERE id = ?").bind(role_id).first();
        
        if (!targetRoleParams) {
             return new Response(JSON.stringify({ error: "Invalid role ID" }), { status: 400 });
        }

        const targetUser = await env.DB.prepare("SELECT email, role_id FROM users WHERE id = ?").bind(user_id).first();
        if (!targetUser) {
             return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
        }

        const superPromoAllowed =
          role_id === "super_admin_role" &&
          targetUser.email &&
          emailInList(env, targetUser.email, "SUPER_ADMIN_PROMOTE_EMAILS");

        const check = validateRoleChange({
          actorRoleId: adminRole?.id,
          targetCurrentRoleId: targetUser.role_id,
          newRoleId: role_id,
          superPromoAllowed,
        });
        if (!check.ok) {
             return new Response(JSON.stringify({ error: check.error }), { status: 403 });
        }

        // Update User
        await env.DB.prepare("UPDATE users SET role_id = ? WHERE id = ?").bind(role_id, user_id).run();

        // Audit Log
        await env.DB.prepare(
            "INSERT INTO audit_logs (id, user_id, action, target_entity_type, target_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
            crypto.randomUUID(), 
            adminId, 
            'role_assigned', 
            'user', 
            user_id, 
            JSON.stringify({ old_role: 'unknown', new_role: role_id, reason })
        ).run();

        return new Response(JSON.stringify({ 
            success: true, 
            message: `User assigned to ${targetRoleParams.name}` 
        }), { 
            headers: { "Content-Type": "application/json" } 
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
