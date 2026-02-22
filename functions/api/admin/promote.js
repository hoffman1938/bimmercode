
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const secret = url.searchParams.get("secret");

  if (secret !== "bimmercodes-admin-secret") {
    return new Response("Unauthorized", { status: 403 });
  }

  if (!email) {
    return new Response("Email required", { status: 400 });
  }

  try {
    const res = await env.DB.prepare("UPDATE users SET role = 'admin' WHERE email = ?")
      .bind(email)
      .run();

    if (res.meta.changes > 0) {
      return new Response(`User ${email} promoted to admin`, { status: 200 });
    } else {
      return new Response("User not found or already admin (no changes)", { status: 404 });
    }
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
