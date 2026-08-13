import { authenticateAdminRequest } from "../../lib/admin-gate.js";
import { ROLE_FILTER_OPTIONS } from "../../lib/role-filters.js";

/** GET /api/admin/roles — roles for admin UI filters */
export async function onRequestGet(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;

  let dbRoles = [];
  try {
    const { results } = await context.env.DB.prepare(
      "SELECT id, name, display_name, level FROM roles ORDER BY level ASC"
    ).all();
    dbRoles = results || [];
  } catch (_) {}

  return new Response(
    JSON.stringify({
      success: true,
      filters: ROLE_FILTER_OPTIONS,
      roles: dbRoles,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
