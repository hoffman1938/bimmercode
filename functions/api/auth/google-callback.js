// functions/api/auth/google-callback.js
import { generateId } from '../../../lib/utils.js';
import { generateToken } from '../../../lib/jwt.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { credential, language = 'en' } = body;
    const db = context.env.DB;

    // 1. Декодируем токен
    const parts = credential.split('.');
    const payload = JSON.parse(atob(parts[1]));
    
    if (!payload || !payload.sub) {
      return new Response(JSON.stringify({ error: "Invalid Google token" }), { status: 400 });
    }

    const googleUser = {
      id: payload.sub,
      email: payload.email,
      picture: payload.picture
    };

    // 2. Ищем пользователя
    let user = await db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?')
      .bind(googleUser.id, googleUser.email).first();

    if (user) {
      // ОБНОВЛЕНИЕ
      await db.prepare(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP, google_id = ?, avatar_url = ? WHERE id = ?'
      ).bind(googleUser.id, googleUser.picture, user.id).run();
      
      // Получаем обновленного юзера
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();

    } else {
      // СОЗДАНИЕ (Строго по полям из SQL выше)
      const userId = generateId();
      let baseUsername = googleUser.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      const username = baseUsername + '_' + Math.floor(Math.random() * 1000);

      // ВАЖНО: Вставляем только те поля, которые точно есть в SQL
      const result = await db.prepare(
        `INSERT INTO users 
         (id, email, username, google_id, avatar_url, role, reputation, locale, created_at, last_login)
         VALUES (?, ?, ?, ?, ?, 'user', 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(userId, googleUser.email, username, googleUser.id, googleUser.picture, language).run();
      
      // Если вставка не прошла, result.success будет false (в некоторых версиях драйвера)
      
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    }

    if (!user) {
      throw new Error("User create/update failed - DB returned null");
    }

    // 3. Создаем сессию
    const sessionToken = await generateToken({ userId: user.id, role: user.role }, context.env.JWT_SECRET);
    const sessionId = generateId();
    
    await db.prepare(
      `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+30 days'))`
    ).bind(sessionId, user.id, sessionToken).run();

    return new Response(JSON.stringify({
      success: true,
      token: sessionToken,
      user: user
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    // ВОТ ЭТО ПОКАЖЕТ ОШИБКУ В КОНСОЛИ БРАУЗЕРА
    console.error('Auth Error Details:', error);
    return new Response(JSON.stringify({ 
      error: "Auth Failed", 
      details: error.message,
      cause: error.cause 
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}