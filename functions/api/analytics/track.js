
export async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const { user_id, event_type, path, referrer, user_agent, device_type, meta } = data;
    
    // Get IP manually from headers
    const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
    const country = request.headers.get("CF-IPCountry") || "Unknown";

    await env.DB.prepare(`
      INSERT INTO analytics_events (user_id, event_type, path, referrer, user_agent, ip_address, country, device_type, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user_id || null, 
      event_type || 'page_view', 
      path || null, 
      referrer || null, 
      user_agent || null, 
      ip, 
      country, 
      device_type || null, 
      meta ? JSON.stringify(meta) : null
    ).run();

    return new Response(JSON.stringify({ success: true }), { 
        headers: { "Content-Type": "application/json" } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
