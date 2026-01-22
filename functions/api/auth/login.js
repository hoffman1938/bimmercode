// functions/api/auth/login.js
export async function onRequestPost(context) {
  try {
    const { email, password } = await context.request.json();
    const db = context.env.DB;

    // Ищем пользователя по email
    const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "Пользователь не найден" }), { status: 404 });
    }

    // ВАЖНО: В реальном проекте здесь должно быть сравнение хешей (bcrypt).
    // Пока сравниваем напрямую, так как мы так сохраняли при регистрации.
    if (user.password_hash !== password) {
      return new Response(JSON.stringify({ error: "Неверный пароль" }), { status: 401 });
    }

    // Возвращаем данные пользователя (без пароля!)
    return new Response(JSON.stringify({
      message: "Login successful",
      user: { id: user.id, username: user.username, email: user.email }
    }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}