// functions/api/auth/login.js
import { generateToken } from '../../../lib/jwt.js';
import { generateId } from '../../../lib/utils.js';
import { verifyPassword } from '../../../lib/crypto.js';

export async function onRequestPost(context) {
  try {
    const { email, password } = await context.request.json();
    const db = context.env.DB;

    const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    if (!user || !user.password_hash) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
    }

    // Обновляем последний вход
    await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

    // Генерируем токен
    const token = await generateToken({ userId: user.id, role: user.role }, context.env.JWT_SECRET);
    const sessionId = generateId();
    
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
        reputation: user.reputation,
        bmw: {
            model: user.bmw_model,
            chassis: user.bmw_chassis,
            engine: user.bmw_engine
        }
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}