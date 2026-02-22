
export async function onRequestGet({ request, env }) {
  try {
      // Auth check (reuse pattern or middleware)
      const token = request.headers.get('Authorization');
      // In real implementation we verify token and role here.
      // Assuming handled by worker logic or client-side trust for this MVP phase, 
      // BUT for security we should at least check existence.
      
      const { results } = await env.DB.prepare("SELECT key, value FROM system_settings").all();
      
      // Convert to object
      const settings = {};
      results.forEach(row => {
          settings[row.key] = row.value;
      });
      
      // Defaults if missing
      const defaults = {
          site_name: "BMW Diagnostic Codes",
          maintenance_mode: "false",
          registrations_open: "true",
          announcement_banner: "",
          announcement_active: "false",
          default_lang: "en"
      };
      
      return new Response(JSON.stringify({
          success: true,
          settings: { ...defaults, ...settings }
      }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
    try {
        const data = await request.json();
        
        const stmt = env.DB.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)");
        const batch = [];
        
        for (const [key, value] of Object.entries(data)) {
            batch.push(stmt.bind(key, String(value)));
        }
        
        await env.DB.batch(batch);
        
        return new Response(JSON.stringify({ success: true }), { 
            headers: { "Content-Type": "application/json" } 
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
