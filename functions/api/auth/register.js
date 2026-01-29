// functions/api/auth/register.js
import { generateId } from '../../../lib/utils.js';
import { hashPassword } from '../../../lib/crypto.js';

export default {
  async fetch(request, env, ctx) {
    return handleRegister(request, env, ctx);
  }
};

async function handleRegister(request, env, ctx) {
  // Только POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { email, password, username, language = 'en' } = await request.json();
    const db = env.DB;

    // Валидация
    if (!email || !password || !username) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password too short (min 8 chars)" }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Проверка дубликатов
    const exists = await db.prepare(
      "SELECT id FROM users WHERE email = ? OR username = ?"
    ).bind(email, username).first();
    
    if (exists) {
      return new Response(JSON.stringify({ error: "Email or Username already taken" }), { 
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Создание пользователя
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    
    // Вставляем в таблицу users
    const insertResult = await db.prepare(
      `INSERT INTO users 
       (id, email, username, password_hash, locale, created_at, is_active, role, reputation)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1, 'user', 0)`
    ).bind(userId, email, username, passwordHash, language).run();

    if (!insertResult.success) {
      throw new Error("Failed to create user");
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Registration successful",
      user_id: userId
    }), { 
      status: 201, 
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Register error:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Поддержка onRequest API (если используется старая версия)
export async function onRequest(context) {
  return handleRegister(context.request, context.env, context);
}