// functions/api/auth/register.js
import { generateId } from '../../../lib/utils.js';
import { hashPassword } from '../../../lib/crypto.js';

export async function onRequestPost(context) {
  try {
    const { email, password, username, language = 'en' } = await context.request.json();
    const db = context.env.DB;

    // Валидация
    if (!email || !password || !username) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password too short (min 8 chars)" }), { status: 400 });
    }

    // Проверка дубликатов
    const exists = await db.prepare("SELECT id FROM users WHERE email = ? OR username = ?").bind(email, username).first();
    if (exists) {
      return new Response(JSON.stringify({ error: "Email or Username already taken" }), { status: 409 });
    }

    // Создание пользователя
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    
    // Вставляем в новую структуру таблицы users
    await db.prepare(
      `INSERT INTO users 
       (id, email, username, password_hash, locale, created_at, is_active, role, reputation)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1, 'user', 0)`
    ).bind(userId, email, username, passwordHash, language).run();

    return new Response(JSON.stringify({
      success: true,
      message: "Registration successful",
      user_id: userId
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}