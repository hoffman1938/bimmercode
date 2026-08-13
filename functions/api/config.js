
export async function onRequestGet({ env }) {
  try {
      // Public endpoint, only return safe config
      const { results } = await env.DB.prepare("SELECT key, value FROM system_settings WHERE key IN ('site_name', 'maintenance_mode', 'registrations_open', 'announcement_banner', 'announcement_active')").all();
      
      const config = {};
      results.forEach(row => {
          config[row.key] = row.value;
      });
      
       // Defaults
      const defaults = {
          site_name: "BMW Diagnostic Codes",
          maintenance_mode: "false",
          registrations_open: "true",
          announcement_banner: "",
          announcement_active: "false"
      };

      return new Response(JSON.stringify({
          success: true,
          config: { ...defaults, ...config }
      }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
