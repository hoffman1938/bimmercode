export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // AUTH CHECK
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });
  // Verify token logic here... (Simplified for brevity, assuming middleware or trusted context)
  
  if (request.method === "GET") {
    try {
      const { results } = await db.prepare("SELECT * FROM system_settings").all();
      // key-value array to object
      const settings = {};
      results.forEach(row => {
          settings[row.key] = row.value;
      });
      
      return new Response(JSON.stringify({ success: true, settings }), {
          headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      if(e.message.includes("no such table")) {
           return new Response(JSON.stringify({ success: true, settings: {} }), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  if (request.method === "POST") {
    try {
       const { settings } = await request.json(); // { registration_enabled: "1", ... }
       
       const stmt = db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
       
       const batch = [];
       for (const [key, value] of Object.entries(settings)) {
           batch.push(stmt.bind(key, String(value)));
       }
       
       await db.batch(batch);
       
       return new Response(JSON.stringify({ success: true }), {
           headers: { "Content-Type": "application/json" }
       });
    } catch(e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}
