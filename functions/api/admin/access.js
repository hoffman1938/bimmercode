/**
 * GET /api/admin/access — lightweight gate for admin.html (Bearer JWT).
 */
import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequestGet(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  return new Response(
    JSON.stringify({ success: true, role_id: auth.role?.id, role: auth.role?.name }),
    { headers: { "Content-Type": "application/json" } }
  );
}
