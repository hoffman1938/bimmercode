// functions/api/auth/register.js
import { generateId } from '../../lib/utils.js';
import { hashPassword } from '../../lib/crypto.js';
import { sendVerificationEmail } from '../../lib/email.js';


const TRANSLATIONS = {
  en: {
    missing_data: "Missing required fields",
    invalid_email: "Invalid email format",
    email_exists: "Email already registered",
    username_taken: "Username already taken",
    weak_password: "Password must be at least 8 characters",
    registration_success: "Registration successful. Check your email to verify.",
    error: "Registration error"
  },
  ru: {
    missing_data: "Заполните все поля",
    invalid_email: "Неверный формат email",
    email_exists: "Email уже зарегистрирован",
    username_taken: "Имя пользователя уже занято",
    weak_password: "Пароль должен быть минимум 8 символов",
    registration_success: "Регистрация успешна. Проверьте email для подтверждения.",
    error: "Ошибка регистрации"
  },
  ka: {
    missing_data: "შეავსეთ ყველა ველი",
    invalid_email: "არასწორი ელფოსტის ფორმატი",
    email_exists: "ეს ელფოსტა უკვე დაფიქსირებულია",
    username_taken: "ეს მომხმარებელი სახელი უკვე დაკავებულია",
    weak_password: "პაროლი უნდა იყოს მინიმუმ 8 სიმბოლო",
    registration_success: "რეგისტრაცია წარმატებული. შეამოწმეთ ელფოსტა დასადასტურებლად.",
    error: "რეგისტრაციის შეცდომა"
  }
};

function t(key, lang = 'en') {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS['en'][key];
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export async function onRequestPost(context) {
  try {
    const { email, password, username, language = 'en' } = await context.request.json();
    const db = context.env.DB;

    // Validate data
    if (!email || !password || !username) {
      return new Response(JSON.stringify({ 
        error: t('missing_data', language) 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ 
        error: t('invalid_email', language) 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ 
        error: t('weak_password', language) 
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Check duplicate email
    const existingEmail = await db.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).bind(email).first();

    if (existingEmail) {
      return new Response(JSON.stringify({ 
        error: t('email_exists', language) 
      }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    // Check duplicate username
    const existingUsername = await db.prepare(
      "SELECT id FROM users WHERE username = ?"
    ).bind(username).first();

    if (existingUsername) {
      return new Response(JSON.stringify({ 
        error: t('username_taken', language) 
      }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    // Create user
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const verificationToken = generateId();

    await db.prepare(
      `INSERT INTO users 
       (id, email, username, password_hash, verification_token, email_verified, created_at, is_active)
       VALUES (?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, 1)`
    ).bind(userId, email, username, passwordHash, verificationToken).run();

    // Send verification email
    try {
      const verificationLink = `${context.env.APP_URL}/forum.html?verify_token=${verificationToken}`;
      await sendVerificationEmail(email, verificationLink, language, context.env);
    } catch (emailErr) {
      console.error('Email send error:', emailErr);
      // Continue anyway - email might fail but registration is complete
    }

    return new Response(JSON.stringify({
      success: true,
      message: t('registration_success', language),
      user_id: userId
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Registration error:', err);
    return new Response(JSON.stringify({ 
      error: "Internal server error: " + err.message 
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}