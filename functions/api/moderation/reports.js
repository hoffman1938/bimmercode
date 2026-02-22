
export async function onRequestGet({ request, env }) {
  try {
      const url = new URL(request.url);
      const status = url.searchParams.get("status") || "pending";
      const limit = parseInt(url.searchParams.get("limit")) || 20;
      const offset = parseInt(url.searchParams.get("offset")) || 0;

      // Join with reporter and reported user to get names
      const { results } = await env.DB.prepare(`
        SELECT 
            r.*,
            reporter.username as reporter_name,
            reported.username as reported_username
        FROM reports r
        LEFT JOIN users reporter ON r.reporter_id = reporter.id
        LEFT JOIN users reported ON r.reported_user_id = reported.id
        WHERE r.status = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(status, limit, offset).all();

      // Get total count
      const total = await env.DB.prepare("SELECT COUNT(*) as total FROM reports WHERE status = ?").bind(status).first('total');

      return new Response(JSON.stringify({
          success: true,
          reports: results,
          total: total,
          page: Math.floor(offset / limit) + 1,
          pages: Math.ceil(total / limit)
      }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
