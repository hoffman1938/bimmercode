// functions/api/categories.js - Public Category List
export async function onRequestGet(context) {
    const { env } = context;
    try {
        const { results } = await env.DB.prepare(
            "SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC"
        ).all();
        
        return new Response(JSON.stringify({ success: true, categories: results }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
