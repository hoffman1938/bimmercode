// functions/api/admin/roles/assign.js - Assign User Roles
import { verifyToken } from "../../../lib/jwt.js";
import { requirePermission, getUserRole } from "../../../lib/permissions.js";

export async function onRequestPost(context) {
    const { request, env } = context;

    // 1. Authenticate
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
    if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });

    const adminId = decoded.id;

    // 2. Permission Check
    const checkPermission = requirePermission('assign_roles');
    const authError = await checkPermission(context, adminId);
    if (authError) return authError;

    // 3. Logic
    try {
        const { user_id, role_id, reason } = await request.json();

        if (!user_id || !role_id) {
            return new Response(JSON.stringify({ error: "User ID and Role ID are required" }), { status: 400 });
        }

        // Prevent self-demotion/promotion if needed, or check hierarchy
        // Ideally, check if admin level > target role level
        const adminRole = await getUserRole(env, adminId);
        const targetRoleParams = await env.DB.prepare("SELECT level, name FROM roles WHERE id = ?").bind(role_id).first();
        
        if (!targetRoleParams) {
             return new Response(JSON.stringify({ error: "Invalid role ID" }), { status: 400 });
        }

        // Simple hierarchy check: Admin level must be >= Target Role level
        // Actually, strictly speaking, you shouldn't be able to assign a role higher than yours.
        if (adminRole.level < targetRoleParams.level && adminRole.name !== 'super_admin') {
             return new Response(JSON.stringify({ error: "Cannot assign a role higher than your own" }), { status: 403 });
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
