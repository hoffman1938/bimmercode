// functions/api/user/get.js - Get User Profile (Public/Private View)

import { getUserLevel } from "../../lib/reputation.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const username = url.searchParams.get("username");
  const id = url.searchParams.get("id");
  const requestorId = request.headers.get("X-User-ID");

  if (!username && !id) {
    return new Response(JSON.stringify({ error: "Username or ID required" }), { status: 400 });
  }

  try {
    let query = `
      SELECT 
        id, username, email, avatar_url, bio,
        created_at, last_login,
        reputation, role_id,
        car_model, bmw_year, bmw_body, bmw_engine,
        city, country,
        privacy_level, preferred_lang, is_active,
        first_name, last_name, role_id as role
      FROM users 
      WHERE `;
    
    let param;

    if (id) {
        query += "id = ?";
        param = id;
    } else {
        query += "username = ?";
        param = username;
    }

    const user = await env.DB.prepare(query).bind(param).first();

    if (!user || user.is_active === 0) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    // 2. Fetch User Level
    let level = 'Novice'; // Default
    try {
        const levelData = await getUserLevel(env, user.reputation || 0, 'en');
        level = levelData?.name || 'Novice';
    } catch (e) {
        console.warn("Failed to get level", e);
    }
    
    // 3. Privacy Check
    let profileData = {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      reputation: user.reputation,
      level: level,
      // joined: user.created_at, // Use created_at directly if frontend expects it
      created_at: user.created_at, 
      role: user.role, // Alias role_id
      bio: user.bio,
      car_model: user.car_model,
      city: user.city,
      country: user.country
    };

    // If private and not owner, hide sensitive fields (simplified for now)
    // For now returning full data as frontend expects it and we trust client 
    // (Actual logic needs privacy check properly implemented)
    if (user.privacy_level !== 'public' && requestorId !== user.id) {
       // profileData.bio = "Private";
    }

    // 4. Stats — topics, replies, reactions-received, activity span
    try {
      const stats = await env.DB.prepare(`
        SELECT
          (SELECT COUNT(*) FROM topics WHERE user_id = ?) AS topics_count,
          (SELECT COUNT(*) FROM posts  WHERE user_id = ?) AS posts_count,
          (SELECT COUNT(*) FROM topics WHERE user_id = ? AND is_solved = 1) AS solved_count
      `).bind(user.id, user.id, user.id).first();
      profileData.stats = stats || { topics_count: 0, posts_count: 0, solved_count: 0 };
    } catch (_) {
      profileData.stats = { topics_count: 0, posts_count: 0, solved_count: 0 };
    }

    try {
      const recent = await env.DB.prepare(`
        SELECT id, title, created_at, reply_count, is_solved, is_pinned, category
        FROM topics
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 5
      `).bind(user.id).all();
      profileData.recent_topics = (recent?.results || []).map((r) => ({
        id: r.id, title: r.title, created_at: r.created_at,
        reply_count: r.reply_count || 0, is_solved: !!r.is_solved,
        is_pinned: !!r.is_pinned, category: r.category,
      }));
    } catch (_) {
      profileData.recent_topics = [];
    }

    profileData.bmw_year   = user.bmw_year || null;
    profileData.bmw_body   = user.bmw_body || null;
    profileData.bmw_engine = user.bmw_engine || null;
    profileData.preferred_lang = user.preferred_lang || null;

    return new Response(JSON.stringify(profileData), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("Get Profile Error:", e);
    return new Response(JSON.stringify({ error: "Failed to fetch profile" }), { status: 500 });
  }
}
