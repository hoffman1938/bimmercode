// functions/api/user/get.js

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "ID required" }), {
      status: 400,
    });
  }

  try {
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(id)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
      });
    }

    // Удаляем хэш пароля перед отправкой (для безопасности)
    delete user.password_hash;

    return new Response(JSON.stringify(user), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
