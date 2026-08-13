import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;

  try {
      const url = new URL(request.url);
      
      // 1. Page Views (Last 24h)
      const { results: pageViews } = await env.DB.prepare(`
        SELECT strftime('%H:00', created_at) as hour, COUNT(*) as count 
        FROM analytics_events 
        WHERE created_at > datetime('now', '-24 hours') 
        GROUP BY hour 
        ORDER BY hour ASC
      `).all();

      // 2. Active Users (Last 15 mins) - Approximate "Realtime"
      const activeUsers = await env.DB.prepare(`
        SELECT COUNT(DISTINCT ip_address) as count 
        FROM analytics_events 
        WHERE created_at > datetime('now', '-15 minutes')
      `).first('count');

      // 3. Top Pages (Last 24h)
      const { results: topPages } = await env.DB.prepare(`
        SELECT path, COUNT(*) as count 
        FROM analytics_events 
        WHERE created_at > datetime('now', '-24 hours') 
        GROUP BY path 
        ORDER BY count DESC 
        LIMIT 5
      `).all();
      
      // 4. Device Stats
      const { results: devices } = await env.DB.prepare(`
        SELECT device_type, COUNT(*) as count 
        FROM analytics_events 
        WHERE created_at > datetime('now', '-24 hours') 
        GROUP BY device_type
      `).all();

      return new Response(JSON.stringify({
        success: true,
        data: {
            pageViews,
            activeUsers,
            topPages,
            devices
        }
      }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
