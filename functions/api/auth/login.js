// functions/api/auth/login.js
import { generateToken } from '../../../lib/jwt.js';
import { generateId } from '../../../lib/utils.js';
import { verifyPassword } from '../../../lib/crypto.js';

export default {
  async fetch(request, env, ctx) {
    return handleLogin(request, env, ctx);
  }
};

async function handleLogin(request, env, ctx) {
  // Только POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { email, password } = await request.json();
    const db = env.DB;

    // Ищем юзера по email
    const user = await db.prepare(
      "SELECT * FROM users WHERE email = ?"
    ).bind(email).first();

    if (!user || !user.password_hash) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Проверяем пароль
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Обновляем last_login
    await db.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(user.id).run();

    // Генерируем токен
    const token = await generateToken(
      { userId: user.id, role: user.role }, 
      env.JWT_SECRET
    );
    const sessionId = generateId();
    
    // Сохраняем сессию
    await db.prepare(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, datetime('now', '+30 days'))`
    ).bind(sessionId, user.id, token).run();

    return new Response(JSON.stringify({
      success: true,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
        reputation: user.reputation || 0,
        locale: user.locale,
        bmw: {
          model: user.bmw_model || null,
          chassis: user.bmw_chassis || null,
          engine: user.bmw_engine || null
        }
      }
    }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Login error:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Поддержка onRequest API (если используется старая версия)
export async function onRequest(context) {
  return handleLogin(context.request, context.env, context);
}