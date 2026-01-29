// functions/api/auth/google-callback.js
import { generateId } from '../../../lib/utils.js';
import { generateToken } from '../../../lib/jwt.js';

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { credential, language = 'en' } = body;
    const db = context.env.DB;

    if (!credential) {
      return new Response(JSON.stringify({ error: "No credential provided" }), { status: 400 });
    }

    // 1. Декодируем Google JWT токен
    let googleUser;
    try {
      const parts = credential.split('.');
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format");
      }
      
      // Добавляем padding если нужно
      const payload = parts[1];
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decoded = JSON.parse(atob(paddedPayload));
      
      googleUser = {
        id: decoded.sub,
        email: decoded.email,
        picture: decoded.picture,
        name: decoded.name
      };

      if (!googleUser.id || !googleUser.email) {
        throw new Error("Missing required Google fields");
      }
    } catch (decodeErr) {
      console.error("JWT Decode Error:", decodeErr);
      return new Response(JSON.stringify({ 
        error: "Invalid Google token",
        details: decodeErr.message
      }), { status: 400 });
    }

    // 2. Ищем существующего пользователя по google_id ИЛИ email
    let user = await db.prepare(
      'SELECT * FROM users WHERE google_id = ? OR email = ?'
    ).bind(googleUser.id, googleUser.email).first();

    if (user) {
      // === ПОЛЬЗОВАТЕЛЬ УЖЕ СУЩЕСТВУЕТ - ОБНОВЛЯЕМ ===
      console.log("User exists, updating...", user.id);
      
      const updateResult = await db.prepare(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP, google_id = ?, avatar_url = ? WHERE id = ?'
      ).bind(googleUser.id, googleUser.picture || null, user.id).run();

      if (!updateResult.success) {
        throw new Error("Failed to update user");
      }

      // Получаем обновленного юзера
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();

    } else {
      // === СОЗДАНИЕ НОВОГО ПОЛЬЗОВАТЕЛЯ ===
      console.log("Creating new user...", googleUser.email);
      
      const userId = generateId();
      let baseUsername = googleUser.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
      // Если username совпадает с существующим, добавляем рандомное число
      const uniqueUsername = baseUsername + '_' + Math.floor(Math.random() * 10000);

      const insertResult = await db.prepare(
        `INSERT INTO users 
         (id, email, username, google_id, avatar_url, role, reputation, locale, is_active, created_at, last_login)
         VALUES (?, ?, ?, ?, ?, 'user', 0, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        userId, 
        googleUser.email, 
        uniqueUsername, 
        googleUser.id, 
        googleUser.picture || null, 
        language
      ).run();

      if (!insertResult.success) {
        console.error("Insert failed:", insertResult);
        throw new Error("Failed to create user in database");
      }

      console.log("User created successfully, ID:", userId);

      // Получаем созданного юзера
      user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();

      if (!user) {
        throw new Error("Failed to retrieve created user from database");
      }
    }

    // 3. Генерируем JWT сессионный токен
    const sessionToken = await generateToken(
      { userId: user.id, role: user.role }, 
      context.env.JWT_SECRET
    );

    // 4. Сохраняем сессию в БД
    const sessionId = generateId();
    const sessionResult = await db.prepare(
      `INSERT INTO sessions (id, user_id, token, expires_at) 
       VALUES (?, ?, ?, datetime('now', '+30 days'))`
    ).bind(sessionId, user.id, sessionToken).run();

    if (!sessionResult.success) {
      console.warn("Warning: Failed to create session, but user is valid");
    }

    // 5. Возвращаем успешный ответ с полными данными юзера
    const responseData = {
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url,
        role: user.role,
        reputation: user.reputation || 0,
        locale: user.locale,
        google_id: user.google_id,
        bmw: {
          model: user.bmw_model || null,
          chassis: user.bmw_chassis || null,
          engine: user.bmw_engine || null
        }
      }
    };

    console.log("Auth successful, returning user:", responseData.user.username);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Google Callback Error:', error);
    console.error('Error Stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: "Authentication failed",
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}