import { generateId } from "../../lib/utils.js";
import { hashPassword } from "../../lib/crypto.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.clone().json();
    console.log("Register Payload:", JSON.stringify(body, null, 2));
    const { email, username, password, language, security_question, security_answer } = body;

    // 1. Валидация
    if (!email || !username || !password || !security_question || !security_answer) {
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
    const answerHash = await hashPassword(security_answer.trim().toLowerCase()); // Normalize answer

    // Вставляем в D1
    await env.DB.prepare(
      `INSERT INTO users (id, email, username, password_hash, preferred_lang, security_question, security_answer_hash, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    )
      .bind(userId, email, username, passwordHash, language || "en", security_question, answerHash)
      .run();

    return new Response(JSON.stringify({ success: true, userId }), {
      status: 201,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
