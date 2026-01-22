// functions/api/auth/register.js

export async function onRequestPost(context) {
  try {
    // 1. Получаем данные от пользователя
    const { email, password, username } = await context.request.json();
    const db = context.env.DB; // Доступ к базе D1

    // 2. Простая валидация
    if (!email || !password || !username) {
      return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });
    }

    // 3. ПРЕДУПРЕЖДЕНИЕ: В реальном проекте пароли нужно хешировать!
    // Для примера сохраняем как есть (но в продакшене используйте bcryptjs)
    // const passwordHash = await hashPassword(password); 
    
    // 4. Записываем в базу
    const result = await db.prepare(
      "INSERT INTO users (email, password_hash, username) VALUES (?, ?, ?)"
    ).bind(email, password, username).run();

    if (!result.success) {
      return new Response(JSON.stringify({ error: "User already exists" }), { status: 409 });
    }

    return new Response(JSON.stringify({ message: "User created!" }), { status: 201 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}