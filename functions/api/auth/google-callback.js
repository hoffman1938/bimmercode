// functions/api/auth/google-callback.js
import { generateId } from '../../../lib/utils.js';
import { generateToken } from '../../../lib/jwt.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { credential, language = 'en' } = body;
    const env = context.env;
    const db = env.DB;

    if (!credential) {
      return new Response(JSON.stringify({ error: "No credential provided" }), { status: 400 });
    }

    // Декодируем JWT от Google
    const parts = credential.split('.');
    const payload = JSON.parse(atob(parts[1]));
    
    if (!payload || !payload.sub) {
      return new Response(JSON.stringify({ error: "Invalid Google token" }), { status: 400 });
    }

    const googleUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };

    // 1. Проверяем, есть ли такой юзер
    let user = await db.prepare(
      'SELECT * FROM users WHERE google_id = ? OR email = ?'
    ).bind(googleUser.id, googleUser.email).first();

    if (user) {
      // ОБНОВЛЕНИЕ: Если юзер есть, обновляем дату входа и аватар
      // Если google_id еще не был привязан (регистрация по email), привязываем сейчас
      await db.prepare(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP, google_id = ?, avatar_url = ? WHERE id = ?'
      ).bind(googleUser.id, googleUser.picture, user.id).run();
      
      // Обновляем объект user для возврата на фронт (берем актуальные данные)
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();

    } else {
      // СОЗДАНИЕ: Юзера нет, создаем нового по НОВОЙ СХЕМЕ
      const userId = generateId();
      // Генерируем уникальный никнейм из email
      let baseUsername = googleUser.email.split('@')[0];
      // Очищаем от спецсимволов
      baseUsername = baseUsername.replace(/[^a-zA-Z0-9]/g, '');
      const username = baseUsername + '_' + Math.floor(Math.random() * 1000);

      await db.prepare(
        `INSERT INTO users 
         (id, email, username, google_id, avatar_url, locale, role, reputation, is_active, email_verified, created_at, last_login)
         VALUES (?, ?, ?, ?, ?, ?, 'user', 0, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(userId, googleUser.email, username, googleUser.id, googleUser.picture, language).run();

      // Получаем созданного юзера
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    }

    // 2. Создаем сессию и токен
    const sessionToken = await generateToken({
      userId: user.id,
      role: user.role
    }, env.JWT_SECRET);

    const sessionId = generateId();
    await db.prepare(
      `INSERT INTO sessions (id, user_id, token, expires_at)
       VALUES (?, ?, ?, datetime('now', '+30 days'))`
    ).bind(sessionId, user.id, sessionToken).run();

    // 3. Формируем ответ для фронтенда
    return new Response(JSON.stringify({
      success: true,
      token: sessionToken, // ЭТОТ ТОКЕН ВАЖЕН для localStorage
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        role: user.role,
        reputation: user.reputation,
        locale: user.locale,
        bmw: {
            model: user.bmw_model,
            chassis: user.bmw_chassis,
            engine: user.bmw_engine
        }
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Google Auth Error:', error);
    return new Response(JSON.stringify({ error: "Server error: " + error.message }), { status: 500 });
  }
}