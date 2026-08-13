/**
 * Emergency bootstrap: promote user to admin_role by email.
 * Requires env secret PROMOTE_SECRET (wrangler pages secret put PROMOTE_SECRET).
 * GET /api/admin/promote?email=...&secret=...
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const secret = url.searchParams.get("secret");
  const expected = env.PROMOTE_SECRET;

  if (!expected) {
    return new Response("Disabled (set PROMOTE_SECRET)", { status: 403 });
  }
  if (secret !== expected) {
    return new Response("Unauthorized", { status: 403 });
  }

  if (!email) {
    return new Response("Email required", { status: 400 });
  }

  try {
    const res = await env.DB.prepare(
      "UPDATE users SET role_id = 'admin_role' WHERE lower(email) = lower(?)"
    )
      .bind(email.trim())
      .run();

    if (res.meta.changes > 0) {
      return new Response(`User ${email} assigned admin role`, { status: 200 });
    }
    return new Response("User not found (no changes)", { status: 404 });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
