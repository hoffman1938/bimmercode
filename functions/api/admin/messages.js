import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;

  if (request.method === "GET") {
    try {
      // Get messages, newest first
      const { results } = await db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 50").all();
      return new Response(JSON.stringify({ success: true, messages: results }), {
          headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
        // If table doesn't exist yet (migration lag), return empty
        if(e.message.includes("no such table")) {
             return new Response(JSON.stringify({ success: true, messages: [] }), { headers: { "Content-Type": "application/json" } });
        }
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  if (request.method === "PUT") {
      try {
          const { id, action } = await request.json(); // action: 'mark_read', 'delete'
          
          if (action === 'mark_read') {
              await db.prepare("UPDATE contact_messages SET is_read = 1 WHERE id = ?").bind(id).run();
          } else if (action === 'delete') {
               await db.prepare("DELETE FROM contact_messages WHERE id = ?").bind(id).run();
          }

          return new Response(JSON.stringify({ success: true }), {
              headers: { "Content-Type": "application/json" }
          });
      } catch(e) {
           return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
  }

  return new Response("Method not allowed", { status: 405 });
}
