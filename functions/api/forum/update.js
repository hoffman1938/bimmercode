// functions/api/user/update.js
import { verifyToken } from '../../../lib/jwt.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    // 1. Проверка авторизации
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return new Response("Unauthorized", { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const payload = await verifyToken(token, env.JWT_SECRET);
    
    if (!payload) return new Response("Invalid token", { status: 401 });

    // 2. Получение данных
    const data = await request.json();
    const userId = payload.userId;

    // 3. Обновление в БД
    // Обновляем BMW данные, язык и аватар
    await db.prepare(`
      UPDATE users 
      SET bmw_model = ?, bmw_chassis = ?, bmw_engine = ?, avatar_url = ?, locale = ?
      WHERE id = ?
    `).bind(
      data.bmw_model || null,
      data.bmw_chassis || null,
      data.bmw_engine || null,
      data.avatar_url || null,
      data.locale || 'en',
      userId
    ).run();

    // 4. Возвращаем обновленный объект юзера (чтобы обновить localStorage)
    const updatedUser = await db.prepare(
      "SELECT id, username, email, avatar_url, role, reputation, bmw_model, bmw_chassis, bmw_engine, locale FROM users WHERE id = ?"
    ).bind(userId).first();

    return new Response(JSON.stringify({ success: true, user: updatedUser }), { 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}