// functions/lib/admin-gate.js — Admin panel access (role-based, DB source of truth)
import { verifyToken } from "./jwt.js";
import { getUserRole } from "./permissions.js";

/** Roles allowed to use /api/admin/* and admin.html */
export const ADMIN_PANEL_ROLE_IDS = new Set(["admin_role", "super_admin_role"]);

/**
 * Verifies Bearer JWT and that users.role_id is admin or super_admin (DB join to roles).
 * See `getUserRole` + env `ADMIN_PANEL_EMAILS` for emergency access.
 * @returns {{ ok: true, userId: string, role: object } | { ok: false, response: Response }}
 */
export async function authenticateAdminRequest(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded?.id) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  const role = await getUserRole(env, decoded.id);
  if (!role || !ADMIN_PANEL_ROLE_IDS.has(role.id)) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Admin access only" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }
  return { ok: true, userId: decoded.id, role };
}
