import { generateToken } from "../../lib/jwt.js";
import { verifyPassword } from "../../lib/crypto.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, password } = await request.json();

    // 1. Ищем пользователя
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first();

    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
      });
    }

    // 2. Проверяем пароль
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
      });
    }

    // 3. Генерируем токен
    // ВАЖНО: JWT_SECRET нужно задать в настройках Pages! Пока используем временный "secret" если не задан.
    const secret = env.JWT_SECRET || "secret-dev-key";

    const token = await generateToken(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      secret,
    );

    // 4. Возвращаем токен и данные юзера
    return new Response(
      JSON.stringify({
        success: true,
        token: token,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar_url,
          lang: user.preferred_lang,
        },
      }),
      { status: 200 },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
