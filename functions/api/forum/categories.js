// functions/api/forum/categories.js
export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  
  // Получаем язык запроса (по умолчанию en)
  const lang = url.searchParams.get("lang") || 'en';
  
  // Выбираем правильную колонку для названия (title_en, title_ru, title_ka)
  // Защита от SQL инъекций через switch/map, а не прямую вставку
  let titleCol = 'title_en';
  if (lang === 'ru') titleCol = 'title_ru';
  if (lang === 'ka') titleCol = 'title_ka';

  try {
    const { results } = await db.prepare(
      `SELECT slug, ${titleCol} as title, icon_class, sort_order 
       FROM categories 
       ORDER BY sort_order ASC`
    ).all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}