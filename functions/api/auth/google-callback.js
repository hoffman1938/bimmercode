// functions/api/auth/google-callback.js
import { generateId } from '../../../lib/utils.js';
import { generateToken } from '../../../lib/jwt.js';

const TRANSLATIONS = {
  en: { invalid_state: "Invalid OAuth state", token_exchange_failed: "Failed to exchange token", user_info_failed: "Failed to get user info", error: "Google authentication error" },
  ru: { invalid_state: "Неверный OAuth state", token_exchange_failed: "Ошибка при обмене токена", user_info_failed: "Ошибка при получении данных пользователя", error: "Ошибка Google аутентификации" },
  ka: { invalid_state: "არასწორი OAuth state", token_exchange_failed: "მოხდა შეცდომა token-ის გაცვლის დროს", user_info_failed: "მოხდა შეცდომა მომხმარებელი ინფოს მიღებისას", error: "Google აუთენტიფიკაციის შეცდომა" }
};

function t(key, lang = 'en') {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key];
}

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('JWT parts wrong:', parts.length);
      return null;
    }
    
    // ✅ ИСПРАВЛЕНО: Более безопасный парсинг
    const payload = atob(parts[1]);
    return JSON.parse(payload);
  } catch (e) {
    console.error('JWT decode error:', e);
    return null;
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { credential, language = 'en' } = body;
    const env = context.env;
    const db = env.DB;

    console.log('Google callback received, credential length:', credential?.length);

    if (!credential) {
      return new Response(JSON.stringify({ error: t('invalid_state', language) }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Decode JWT from Google
    const payload = decodeJWT(credential);
    
    if (!payload || !payload.sub) {
      console.error('JWT decode failed or no sub');
      return new Response(JSON.stringify({ error: t('invalid_state', language) }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const googleUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified
    };

    console.log('Google user:', googleUser.email, googleUser.id);

    // Check if user exists
    let user = await db.prepare(
      'SELECT * FROM users WHERE google_id = ? OR email = ?'
    ).bind(googleUser.id, googleUser.email).first();

    if (user) {
      // Update existing user
      await db.prepare(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP, google_id = ? WHERE id = ?'
      ).bind(googleUser.id, user.id).run();
    } else {
      // Create new user
      const userId = generateId();
      const username = googleUser.email.split('@')[0] + '_' + generateId().substring(0, 4);

      console.log('Creating new user:', username);

      await db.prepare(
        `INSERT INTO users 
         (id, email, username, google_id, avatar_url, email_verified, last_login, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)`
      ).bind(userId, googleUser.email, username, googleUser.id, googleUser.picture).run();

      user = {
        id: userId,
        email: googleUser.email,
        username: username,
        google_id: googleUser.id,
        avatar_url: googleUser.picture,
        email_verified: true
      };
    }

    // Create JWT session token
    const sessionToken = await generateToken({
      userId: user.id,
      email: user.email,
      username: user.username
    }, env.JWT_SECRET);

    // Save session
    const sessionId = generateId();
    await db.prepare(
      `INSERT INTO sessions (id, user_id, token, expires_at, created_at, last_activity)
       VALUES (?, ?, ?, datetime('now', '+30 days'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(sessionId, user.id, sessionToken).run();

    return new Response(JSON.stringify({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Google callback error:', error);
    return new Response(JSON.stringify({ error: "Internal server error: " + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}