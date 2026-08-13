// functions/api/reputation/history.js - Get Reputation History
import { verifyToken } from "../../lib/jwt.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  
  // 1. Auth
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  
  // 2. Logic
  try {
      const url = new URL(request.url);
      const targetUserId = url.searchParams.get("user_id") || decoded.id; // View own if not specified
      
      // Permission check? 
      // Users can view their own. Admins can view anyone.
      // Mod/User viewing others? Maybe public info. Let's allow public view for transparency.
      
      const history = await env.DB.prepare(`
          SELECT * FROM reputation_history 
          WHERE user_id = ? 
          ORDER BY created_at DESC 
          LIMIT 50
      `).bind(targetUserId).all();
      
      return new Response(JSON.stringify({ success: true, history: history.results }), {
          headers: { "Content-Type": "application/json" }
      });
  } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
