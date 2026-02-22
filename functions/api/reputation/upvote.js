// functions/api/reputation/upvote.js - Upvote Post API
import { verifyToken } from "../../lib/jwt.js";
import { addReputation, canVote } from "../../lib/reputation.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Authenticate
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const secret = env.JWT_SECRET || "secret-dev-key";
  const decoded = await verifyToken(token, secret);
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  
  const userId = decoded.id;

  try {
    const { post_id } = await request.json();
    if (!post_id) return new Response(JSON.stringify({ error: "Post ID required" }), { status: 400 });

    // 2. Get Post & Author
    const post = await env.DB.prepare(`
        SELECT posts.user_id, title FROM posts 
        JOIN topics ON posts.topic_id = topics.id 
        WHERE posts.id = ?
    `).bind(post_id).first();
    
    // Fallback if post not found or it's a topic (assuming topics are posts in disjoint logic, but let's stick to posts table)
    // If we want to upvote Topic, we need separate logic or unified table. 
    // For now, let's assume we are upvoting a reply (Post).
    
    if (!post) return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 });
    
    const targetUserId = post.user_id;

    // 3. Check Eligibility
    const eligibility = await canVote(env, userId, targetUserId, post_id);
    if (!eligibility.allowed) {
        return new Response(JSON.stringify({ error: eligibility.error }), { status: 403 });
    }

    // 4. Record Like
    await env.DB.prepare(`
        INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)
    `).bind(userId, post_id).run();

    // 5. Award Reputation (Weighted)
    const points = 10 * (eligibility.voteWeight || 1);
    
    await addReputation(env, targetUserId, points, "post_upvoted", {
        entityType: 'post',
        entityId: post_id
    });
    
    return new Response(JSON.stringify({ 
        success: true, 
        message: "Upvoted successfully",
        points_awarded: points 
    }), {
        headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
      console.error(e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
