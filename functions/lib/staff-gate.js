// Staff roles that may pin topics/posts (forum moderation, not full admin panel).
import { verifyToken } from "./jwt.js";
import { getUserRole } from "./permissions.js";

export const STAFF_ROLE_IDS = new Set([
  "super_admin_role",
  "admin_role",
  "senior_moderator_role",
  "moderator_role",
]);

export function isStaffRoleId(roleId) {
  return STAFF_ROLE_IDS.has(roleId);
}

/**
 * @returns {{ ok: true, userId: string, role: object } | { ok: false, response: Response }}
 */
export async function authenticateStaffRequest(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const decoded = await verifyToken(authHeader.slice(7), env.JWT_SECRET || "secret-dev-key");
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
  if (!role || !STAFF_ROLE_IDS.has(role.id)) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Staff access only" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { ok: true, userId: decoded.id, role };
}
