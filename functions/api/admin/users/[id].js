
export async function onRequestGet({ request, env }) {
  try {
      const url = new URL(request.url);
      const parts = url.pathname.split('/');
      const userId = parts[parts.length - 1]; // /api/admin/users/:id

      if (!userId) {
          return new Response(JSON.stringify({ error: "User ID required" }), { status: 400 });
      }

      // 1. Basic User Info
      const user = await env.DB.prepare(`
        SELECT id, username, email, role_id, created_at, last_login, is_active, reputation, failed_login_attempts
        FROM users WHERE id = ?
      `).bind(userId).first();

      if (!user) {
          return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
      }

      // 2. Login History (Last 10)
      const { results: logins } = await env.DB.prepare(`
        SELECT ip_address, created_at, success, failure_reason 
        FROM login_attempts 
        WHERE identifier = ? OR identifier = ?
        ORDER BY created_at DESC LIMIT 10
      `).bind(user.email, user.username).all();

      // 3. Warnings
      const { results: warnings } = await env.DB.prepare(`
        SELECT reason, severity, created_at 
        FROM warnings 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).bind(userId).all();

      // 4. Reputation History (Last 10)
      const { results: reputation } = await env.DB.prepare(`
        SELECT change_amount, reason, created_at 
        FROM reputation_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC LIMIT 10
      `).bind(userId).all();

      return new Response(JSON.stringify({
          success: true,
          user: user,
          history: {
              logins,
              warnings,
              reputation
          }
      }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
