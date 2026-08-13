// functions/api/user/get.js - Get User Profile (Public/Private View)

import { getUserLevel } from "../../lib/reputation.js";
import { verifyToken } from "../../lib/jwt.js";
import { isUserBlockedBy } from "../../lib/user-blocks.js";

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
    const whereCol = id ? "id = ?" : "username = ?";
    const param = id || username;

    const fullSelect = `
      SELECT
        id, username, email, avatar_url, bio,
        created_at, last_login, age,
        reputation,
        car_model, bmw_year, bmw_body, bmw_engine,
        city, country,
        privacy_level, preferred_lang, is_active,
        first_name, last_name, role_id AS role
      FROM users WHERE ${whereCol}`;

    const minimalSelect = `
      SELECT
        id, username, email, avatar_url, bio,
        created_at, last_login,
        reputation, car_model, preferred_lang, is_active,
        role_id AS role
      FROM users WHERE ${whereCol}`;

    let user;
    try {
      user = await env.DB.prepare(fullSelect).bind(param).first();
    } catch (queryErr) {
      const msg = String(queryErr?.message || queryErr);
      if (!msg.includes("no such column")) throw queryErr;
      user = await env.DB.prepare(minimalSelect).bind(param).first();
    }

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
    
    let requestorIsOwner = false;
    let requestorId = null;
    const auth = request.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const payload = await verifyToken(auth.slice(7), env.JWT_SECRET || "secret-dev-key");
      if (payload?.id) {
        requestorId = String(payload.id);
        if (requestorId === String(user.id)) requestorIsOwner = true;
      }
    }

    let viewerHasBlocked = false;
    let viewerMutesNotifsFromUser = false;
    if (requestorId && requestorId !== String(user.id)) {
      try {
        viewerHasBlocked = await isUserBlockedBy(env.DB, requestorId, user.id);
        const m = await env.DB
          .prepare(
            "SELECT 1 AS x FROM notification_mutes WHERE user_id = ? AND scope = 'user' AND target_id = ? LIMIT 1"
          )
          .bind(requestorId, String(user.id))
          .first();
        viewerMutesNotifsFromUser = !!m;
      } catch {
        /* ignore */
      }
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
      country: user.country,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      age: user.age != null ? user.age : null,
    };
    if (requestorIsOwner) {
      profileData.email = user.email;
    }

    if (requestorId && requestorId !== String(user.id)) {
      profileData.viewer_has_blocked = viewerHasBlocked;
      profileData.viewer_mutes_notifs_from_user = viewerMutesNotifsFromUser;
    }

    // If private and not owner, hide sensitive fields (simplified for now)
    // For now returning full data as frontend expects it and we trust client 
    // (Actual logic needs privacy check properly implemented)
    if (user.privacy_level !== 'public' && requestorId !== user.id) {
       // profileData.bio = "Private";
    }

    // 4. Stats — hidden from viewer if they blocked this profile user
    const hideFromViewer = viewerHasBlocked;
    if (!hideFromViewer) {
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
    } else {
      profileData.stats = { topics_count: 0, posts_count: 0, solved_count: 0 };
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
