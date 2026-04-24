import { authenticateAdminRequest } from "../../../lib/admin-gate.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;

  try {
      const data = await request.json();
      const { message, title } = data;

      if (!message) {
          return new Response(JSON.stringify({ error: "Message required" }), { status: 400 });
      }

      // 1. Get all active users
      const { results: users } = await env.DB.prepare("SELECT id FROM users WHERE is_active = 1").all();
      
      // 2. Batch insert notifications
      const stmt = env.DB.prepare(`
        INSERT INTO notifications (id, user_id, type, topic_title, created_at) 
        VALUES (?, ?, 'system', ?, CURRENT_TIMESTAMP)
      `);
      
      const batch = [];
      const BATCH_SIZE = 50; // D1 limit might apply, proceed in chunks if massive, but for now simplistic
      
      for (const user of users) {
          batch.push(stmt.bind(crypto.randomUUID(), user.id, (title || "System Announcement") + ": " + message));
          // Note: schema uses `type` and `topic_title`. We repurpose `topic_title` for the system message content for now,
          // or we should update schema. Given "add everything", let's be clever.
          // Schema has: type (TEXT), topic_title (TEXT). 
          // Client `live.js` displays `topic_title`.
      }

      // Execute in chunks
      for (let i = 0; i < batch.length; i += BATCH_SIZE) {
          const chunk = batch.slice(i, i + BATCH_SIZE);
          await env.DB.batch(chunk);
      }

      return new Response(JSON.stringify({ 
          success: true, 
          count: users.length 
      }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
