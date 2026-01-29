// functions/api/forum/categories.js

export async function onRequest(context) {
  const db = context.env.DB;

  try {
    // Получаем категории, отсортированные по порядку
    const { results } = await db.prepare(
      "SELECT * FROM categories ORDER BY sort_order ASC"
    ).all();

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}