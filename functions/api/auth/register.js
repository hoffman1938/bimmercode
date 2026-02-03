import { generateId } from "../../lib/utils.js";
import { hashPassword } from "../../lib/crypto.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, username, password, language } = await request.json();

    // 1. Валидация
    if (!email || !username || !password) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
      });
    }

    // 2. Проверка дубликатов
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ? OR username = ?",
    )
      .bind(email, username)
      .first();

    if (existing) {
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 409,
      });
    }

    // 3. Создание пользователя
    const userId = generateId();
    const passwordHash = await hashPassword(password);

    // Вставляем в D1
    await env.DB.prepare(
      `INSERT INTO users (id, email, username, password_hash, preferred_lang, created_at) 
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
      .bind(userId, email, username, passwordHash, language || "en")
      .run();

    return new Response(JSON.stringify({ success: true, userId }), {
      status: 201,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
