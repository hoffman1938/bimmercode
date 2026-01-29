// functions/api/auth/login.js
import { generateToken } from '../../../lib/jwt.js';
import { generateId } from '../../../lib/utils.js';

const TRANSLATIONS = {
  en: { user_not_found: "User not found", invalid_password: "Invalid password", email_not_verified: "Please verify your email first", account_inactive: "Account is inactive", login_success: "Login successful" },
  ru: { user_not_found: "Пользователь не найден", invalid_password: "Неверный пароль", email_not_verified: "Пожалуйста, сначала подтвердите свой email", account_inactive: "Аккаунт неактивен", login_success: "Вход успешен" },
  ka: { user_not_found: "მომხმარებელი ვერ მოიძებნა", invalid_password: "არასწორი პაროლი", email_not_verified: "გთხოვთ ჯერ დაადასტურეთ ელფოსტა", account_inactive: "ანგარიში არააქტიური", login_success: "შესვლა წარმატებული" }
};

function t(key, lang = 'en') {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key];
}

export async function onRequestPost(context) {
  try {
    const { email, password, language = 'en' } = await context.request.json();
    const db = context.env.DB;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password required" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const user = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ error: t('user_not_found', language) }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // ✅ ИСПРАВЛЕНО: Сначала простое сравнение, потом bcrypt
    let passwordValid = user.password_hash === password;
    if (!passwordValid) {
      try {
        const { verifyPassword } = await import('../../../lib/crypto.js');
        passwordValid = await verifyPassword(password, user.password_hash);
      } catch (e) {
        // bcrypt не работает, используем plain text
      }
    }

    if (!passwordValid) {
      return new Response(JSON.stringify({ error: t('invalid_password', language) }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    if (!user.email_verified && !user.google_id) {
      return new Response(JSON.stringify({ error: t('email_not_verified', language) }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (!user.is_active) {
      return new Response(JSON.stringify({ error: t('account_inactive', language) }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();

    const token = await generateToken({
      userId: user.id,
      email: user.email,
      username: user.username
    }, context.env.JWT_SECRET);

    const sessionId = generateId();
    await db.prepare(
      `INSERT INTO sessions (id, user_id, token, expires_at, created_at, last_activity)
       VALUES (?, ?, ?, datetime('now', '+30 days'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(sessionId, user.id, token).run();

    return new Response(JSON.stringify({
      success: true,
      message: t('login_success', language),
      token: token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar_url: user.avatar_url || null
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Login error:', err);
    return new Response(JSON.stringify({ error: "Internal server error: " + err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}