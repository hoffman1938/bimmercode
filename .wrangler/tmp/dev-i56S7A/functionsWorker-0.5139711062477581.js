var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-zEBESC/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/pages-kEPKW7/functionsWorker-0.5139711062477581.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var urls2 = /* @__PURE__ */ new Set();
function checkURL2(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls2.has(url.toString())) {
      urls2.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL2, "checkURL");
__name2(checkURL2, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL2(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});
async function onRequestPost(context) {
  const { request, env, params } = context;
  const notificationId = params.id;
  if (!notificationId) {
    return new Response("Missing notification ID", { status: 400 });
  }
  try {
    const db = env.DB;
    await db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").bind(notificationId).run();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost, "onRequestPost");
__name2(onRequestPost, "onRequestPost");
async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const secret = url.searchParams.get("secret");
  if (secret !== "bimmercodes-admin-secret") {
    return new Response("Unauthorized", { status: 403 });
  }
  if (!email) {
    return new Response("Email required", { status: 400 });
  }
  try {
    const res = await env.DB.prepare("UPDATE users SET role = 'admin' WHERE email = ?").bind(email).run();
    if (res.meta.changes > 0) {
      return new Response(`User ${email} promoted to admin`, { status: 200 });
    } else {
      return new Response("User not found or already admin (no changes)", { status: 404 });
    }
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
}
__name(onRequestGet, "onRequestGet");
__name2(onRequestGet, "onRequestGet");
async function onRequestPost2(context) {
  const { request, env } = context;
  try {
    const { email } = await request.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400 });
    }
    const user = await env.DB.prepare(
      "SELECT security_question FROM users WHERE email = ?"
    ).bind(email).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }
    if (!user.security_question) {
      return new Response(JSON.stringify({ error: "No security question set for this account" }), { status: 400 });
    }
    return new Response(JSON.stringify({ question: user.security_question }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost2, "onRequestPost2");
__name2(onRequestPost2, "onRequestPost");
async function sign(text, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(sign, "sign");
__name2(sign, "sign");
async function generateToken(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
__name(generateToken, "generateToken");
__name2(generateToken, "generateToken");
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
__name2(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash) {
  const newHash = await hashPassword(password);
  return newHash === storedHash;
}
__name(verifyPassword, "verifyPassword");
__name2(verifyPassword, "verifyPassword");
async function onRequestPost3(context) {
  const { request, env } = context;
  try {
    const { email, password } = await request.json();
    const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401
      });
    }
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401
      });
    }
    const secret = env.JWT_SECRET || "secret-dev-key";
    const token = await generateToken(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      secret
    );
    return new Response(
      JSON.stringify({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar_url,
          lang: user.preferred_lang,
          role: user.role
        }
      }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost3, "onRequestPost3");
__name2(onRequestPost3, "onRequestPost");
async function onRequestPost4(context) {
  const { request, env } = context;
  try {
    const { email, answer, newPassword } = await request.json();
    if (!email || !answer || !newPassword) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }
    const user = await env.DB.prepare(
      "SELECT id, security_answer_hash FROM users WHERE email = ?"
    ).bind(email).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }
    if (!user.security_answer_hash) {
      return new Response(JSON.stringify({ error: "Recovery not configured for this account" }), { status: 403 });
    }
    const normalizedAnswer = answer.trim().toLowerCase();
    const isValid = await verifyPassword(normalizedAnswer, user.security_answer_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Incorrect answer" }), { status: 401 });
    }
    const newHash = await hashPassword(newPassword);
    await env.DB.prepare(
      "UPDATE users SET password_hash = ? WHERE id = ?"
    ).bind(newHash, user.id).run();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost4, "onRequestPost4");
__name2(onRequestPost4, "onRequestPost");
function generateId() {
  return crypto.randomUUID();
}
__name(generateId, "generateId");
__name2(generateId, "generateId");
async function onRequestPost5(context) {
  const { request, env } = context;
  try {
    const { email, username, password, language, security_question, security_answer } = await request.json();
    if (!email || !username || !password || !security_question || !security_answer) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400
      });
    }
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ? OR username = ?"
    ).bind(email, username).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 409
      });
    }
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const answerHash = await hashPassword(security_answer.trim().toLowerCase());
    await env.DB.prepare(
      `INSERT INTO users (id, email, username, password_hash, preferred_lang, security_question, security_answer_hash, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(userId, email, username, passwordHash, language || "en", security_question, answerHash).run();
    return new Response(JSON.stringify({ success: true, userId }), {
      status: 201
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost5, "onRequestPost5");
__name2(onRequestPost5, "onRequestPost");
async function onRequestPost6(context) {
  const { request, env } = context;
  try {
    const { type, id, user_id } = await request.json();
    const user = await env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(user_id).first();
    const isAdmin = user && user.role === "admin";
    if (type === "post") {
      let query = "DELETE FROM posts WHERE id = ?";
      const params = [id];
      if (!isAdmin) {
        query += " AND user_id = ?";
        params.push(user_id);
      }
      const result = await env.DB.prepare(query).bind(...params).run();
      if (result.meta.changes > 0)
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    if (type === "topic") {
      if (!isAdmin) {
        const topic = await env.DB.prepare("SELECT user_id FROM topics WHERE id = ?").bind(id).first();
        if (!topic || topic.user_id !== user_id) {
          return new Response(JSON.stringify({ error: "Access denied" }), { status: 403 });
        }
      }
      await env.DB.prepare("DELETE FROM posts WHERE topic_id = ?").bind(id).run();
      const result = await env.DB.prepare("DELETE FROM topics WHERE id = ?").bind(id).run();
      if (result.meta.changes > 0)
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(
      JSON.stringify({ error: "Access denied or not found" }),
      { status: 403 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost6, "onRequestPost6");
__name2(onRequestPost6, "onRequestPost");
async function onRequestPost7(context) {
  const { request, env } = context;
  try {
    const { type, id, user_id, content } = await request.json();
    if (!content || !content.trim()) {
      return new Response(
        JSON.stringify({ error: "Content cannot be empty" }),
        { status: 400 }
      );
    }
    let result;
    if (type === "topic") {
      result = await env.DB.prepare(
        "UPDATE topics SET content = ? WHERE id = ? AND user_id = ?"
      ).bind(content, id, user_id).run();
    } else {
      result = await env.DB.prepare(
        "UPDATE posts SET content = ? WHERE id = ? AND user_id = ?"
      ).bind(content, id, user_id).run();
    }
    if (result.meta.changes > 0) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } else {
      return new Response(
        JSON.stringify({ error: "Update failed or access denied" }),
        { status: 403 }
      );
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost7, "onRequestPost7");
__name2(onRequestPost7, "onRequestPost");
async function onRequestPost8(context) {
  const { request, env } = context;
  const db = env.DB;
  try {
    const { post_id, user_id } = await request.json();
    if (!post_id || !user_id)
      return new Response(JSON.stringify({ error: "Missing data" }), {
        status: 400
      });
    const existing = await db.prepare("SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?").bind(user_id, post_id).first();
    let liked = false;
    if (existing) {
      await db.prepare("DELETE FROM post_likes WHERE user_id = ? AND post_id = ?").bind(user_id, post_id).run();
      const postInfo = await db.prepare("SELECT user_id FROM posts WHERE id = ?").bind(post_id).first();
      if (postInfo && String(postInfo.user_id) !== String(user_id)) {
        await db.prepare("UPDATE users SET reputation = MAX(0, COALESCE(reputation, 0) - 1) WHERE id = ?").bind(postInfo.user_id).run();
      }
    } else {
      await db.prepare("INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)").bind(user_id, post_id).run();
      liked = true;
      const post = await db.prepare(
        "SELECT p.user_id, t.id as topic_id, t.title FROM posts p JOIN topics t ON p.topic_id = t.id WHERE p.id = ?"
      ).bind(post_id).first();
      const sender = await db.prepare("SELECT username FROM users WHERE id = ?").bind(user_id).first();
      const senderName = sender ? sender.username : "User";
      if (post && String(post.user_id) !== String(user_id)) {
        await db.prepare("UPDATE users SET reputation = COALESCE(reputation, 0) + 1 WHERE id = ?").bind(post.user_id).run();
        const metadata = JSON.stringify({
          sender_id: user_id,
          sender_name: senderName,
          topic_id: post.topic_id,
          post_id
        });
        await db.prepare(
          `
          INSERT INTO notifications (id, user_id, type, title, text, link, icon, metadata)
          VALUES (?, ?, 'like', ?, ?, ?, 'fa-heart', ?)
        `
        ).bind(
          crypto.randomUUID(),
          post.user_id,
          "New like",
          senderName + " liked your post",
          `/topic?id=${post.topic_id}#post-${post_id}`,
          metadata
        ).run();
      }
    }
    const countResult = await db.prepare("SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?").bind(post_id).first();
    return new Response(
      JSON.stringify({ success: true, liked, count: countResult.count }),
      { status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost8, "onRequestPost8");
__name2(onRequestPost8, "onRequestPost");
async function onRequestPost9(context) {
  const { request, env } = context;
  const db = env.DB;
  try {
    const { topic_id, post_id, user_id } = await request.json();
    if (!topic_id || !post_id || !user_id)
      return new Response("Missing data", { status: 400 });
    const topic = await db.prepare("SELECT user_id, title FROM topics WHERE id = ?").bind(topic_id).first();
    if (!topic || String(topic.user_id) !== String(user_id)) {
      return new Response(
        JSON.stringify({ error: "Only topic author can mark solution" }),
        { status: 403 }
      );
    }
    await db.prepare("UPDATE posts SET is_solution = 0 WHERE topic_id = ?").bind(topic_id).run();
    await db.prepare("UPDATE posts SET is_solution = 1 WHERE id = ?").bind(post_id).run();
    await db.prepare("UPDATE topics SET is_solved = 1 WHERE id = ?").bind(topic_id).run();
    const post = await db.prepare("SELECT user_id FROM posts WHERE id = ?").bind(post_id).first();
    const sender = await db.prepare("SELECT username FROM users WHERE id = ?").bind(user_id).first();
    if (post && String(post.user_id) !== String(user_id)) {
      await db.prepare("UPDATE users SET reputation = COALESCE(reputation, 0) + 10 WHERE id = ?").bind(post.user_id).run();
    }
    if (post && String(post.user_id) !== String(user_id)) {
      const metadata = JSON.stringify({
        sender_id: user_id,
        sender_name: sender.username,
        topic_id,
        post_id
      });
      await db.prepare(
        `
        INSERT INTO notifications (id, user_id, type, title, text, link, icon, metadata)
        VALUES (?, ?, 'solve', ?, ?, ?, 'fa-check-circle', ?)
      `
      ).bind(
        crypto.randomUUID(),
        post.user_id,
        "Solution marked",
        sender.username + " marked your post as solution",
        `/topic?id=${topic_id}#post-${post_id}`,
        metadata
      ).run();
    }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost9, "onRequestPost9");
__name2(onRequestPost9, "onRequestPost");
async function onRequestPost10(context) {
  const { request, env } = context;
  try {
    const { user_id } = await request.json();
    if (!user_id) {
      return new Response("Missing user_id", { status: 400 });
    }
    const db = env.DB;
    await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").bind(user_id).run();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost10, "onRequestPost10");
__name2(onRequestPost10, "onRequestPost");
async function onRequestGet2(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "ID required" }), {
      status: 400
    });
  }
  try {
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404
      });
    }
    delete user.password_hash;
    return new Response(JSON.stringify(user), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
      },
      status: 200
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestGet2, "onRequestGet2");
__name2(onRequestGet2, "onRequestGet");
async function onRequestPost11(context) {
  const { request, env } = context;
  try {
    const { id, avatar_url, bio, car_model } = await request.json();
    if (!id) {
      return new Response(JSON.stringify({ error: "User ID required" }), {
        status: 400
      });
    }
    await env.DB.prepare(
      `
      UPDATE users 
      SET 
        avatar_url = COALESCE(?, avatar_url), 
        bio = ?, 
        car_model = ? 
      WHERE id = ?
    `
    ).bind(avatar_url, bio, car_model, id).run();
    const updatedUser = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    return new Response(JSON.stringify({ success: true, user: updatedUser }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestPost11, "onRequestPost11");
__name2(onRequestPost11, "onRequestPost");
async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  if (request.method === "GET") {
    const topicId = url.searchParams.get("id");
    const currentUserId = url.searchParams.get("user_id");
    if (!topicId)
      return new Response(JSON.stringify({ error: "ID required" }), {
        status: 400
      });
    try {
      const topic = await db.prepare(
        `
          SELECT t.*, u.avatar_url as author_avatar, u.role as author_role 
          FROM topics t
          LEFT JOIN users u ON t.user_id = u.id
          WHERE t.id = ?
        `
      ).bind(topicId).first();
      if (!topic)
        return new Response(JSON.stringify({ error: "Not found" }), {
          status: 404
        });
      let postsQuery = `
  SELECT 
    p.*,
    u.avatar_url as author_avatar,  -- \u0414\u043E\u0441\u0442\u0430\u0435\u043C \u0430\u0432\u0430\u0442\u0430\u0440\u043A\u0443 \u0430\u0432\u0442\u043E\u0440\u0430
    u.role as author_role,          -- \u0414\u043E\u0441\u0442\u0430\u0435\u043C \u0440\u043E\u043B\u044C \u0430\u0432\u0442\u043E\u0440\u0430
    (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
    EXISTS (SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
  FROM posts p 
  LEFT JOIN users u ON p.user_id = u.id -- \u041F\u0440\u0438\u0441\u043E\u0435\u0434\u0438\u043D\u044F\u0435\u043C \u0442\u0430\u0431\u043B\u0438\u0446\u0443 \u044E\u0437\u0435\u0440\u043E\u0432
  WHERE p.topic_id = ? 
  ORDER BY p.created_at ASC
`;
      const safeUserId = currentUserId || "guest";
      const { results: posts } = await db.prepare(postsQuery).bind(safeUserId, topicId).all();
      const cleanPosts = posts.map((p) => ({
        ...p,
        is_liked: p.is_liked === 1,
        // D1 возвращает время как строку "YYYY-MM-DD HH:MM:SS". Добавляем 'Z', чтобы считать это UTC
        created_at: p.created_at.endsWith("Z") ? p.created_at : p.created_at + "Z"
      }));
      context.waitUntil(
        db.prepare("UPDATE topics SET views = views + 1 WHERE id = ?").bind(topicId).run()
      );
      return new Response(JSON.stringify({ topic, posts: cleanPosts }), {
        status: 200
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500
      });
    }
  }
  if (request.method === "POST") {
    try {
      const data = await request.json();
      if (!data.topic_id || !data.content || !data.user_id) {
        return new Response(JSON.stringify({ error: "Missing fields" }), {
          status: 400
        });
      }
      const postId = crypto.randomUUID();
      await db.prepare(
        "INSERT INTO posts (id, topic_id, user_id, username, content, lang) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        postId,
        data.topic_id,
        data.user_id,
        data.username,
        data.content,
        data.lang || "en"
      ).run();
      const topic = await db.prepare("SELECT user_id, title FROM topics WHERE id = ?").bind(data.topic_id).first();
      if (topic && String(topic.user_id) !== String(data.user_id)) {
        const metadata = JSON.stringify({
          sender_id: data.user_id,
          sender_name: data.username,
          topic_id: data.topic_id,
          post_id: postId
        });
        await db.prepare(
          `
          INSERT INTO notifications (id, user_id, type, title, text, link, icon, metadata)
          VALUES (?, ?, 'reply', ?, ?, ?, 'fa-reply', ?)
        `
        ).bind(
          crypto.randomUUID(),
          topic.user_id,
          "New reply in " + topic.title,
          data.username + " replied to your topic",
          `/topic?id=${data.topic_id}#post-${postId}`,
          metadata
        ).run();
      }
      return new Response(JSON.stringify({ success: true, postId }), {
        status: 201
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500
      });
    }
  }
}
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
async function onRequest2(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  if (request.method === "GET") {
    try {
      const category = url.searchParams.get("category");
      const search = url.searchParams.get("search");
      const page = parseInt(url.searchParams.get("page") || "1", 10);
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      const offset = (page - 1) * limit;
      const params = [];
      const conditions = [];
      if (category && category !== "all") {
        conditions.push("t.category = ?");
        params.push(category);
      }
      if (search) {
        conditions.push("(t.title LIKE ? OR t.content LIKE ?)");
        params.push(`%${search}%`);
        params.push(`%${search}%`);
      }
      const userId = url.searchParams.get("user_id");
      if (userId) {
        conditions.push("t.user_id = ?");
        params.push(userId);
      }
      const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
      const countQuery = `SELECT COUNT(*) as total FROM topics t ${whereClause}`;
      const countStmt = db.prepare(countQuery).bind(...params);
      const countResult = await countStmt.first();
      const total = countResult.total;
      let query = `
        SELECT t.*, COUNT(p.id) as reply_count 
        FROM topics t 
        LEFT JOIN posts p ON p.topic_id = t.id 
        ${whereClause}
        GROUP BY t.id 
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `;
      const dataParams = [...params, limit, offset];
      const stmt = db.prepare(query).bind(...dataParams);
      const { results } = await stmt.all();
      return new Response(JSON.stringify({
        topics: results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500
      });
    }
  }
  if (request.method === "POST") {
    try {
      const data = await request.json();
      if (!data.title || !data.content || !data.user_id) {
        return new Response(JSON.stringify({ error: "Missing fields: " + JSON.stringify(data) }), {
          status: 400
        });
      }
      const topicId = crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == "x" ? r : r & 3 | 8;
        return v.toString(16);
      });
      await db.prepare(
        "INSERT INTO topics (id, user_id, username, category, title, content, related_code, lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        topicId,
        data.user_id,
        data.username,
        data.category || "general",
        data.title,
        data.content,
        data.related_code || null,
        data.lang || "en"
      ).run();
      return new Response(JSON.stringify({ success: true, topicId }), {
        status: 201
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500
      });
    }
  }
  return new Response("Method not allowed", { status: 405 });
}
__name(onRequest2, "onRequest2");
__name2(onRequest2, "onRequest");
async function onRequestDelete(context) {
  const { request, env, params } = context;
  const notificationId = params.id;
  if (!notificationId) {
    return new Response("Missing notification ID", { status: 400 });
  }
  try {
    const db = env.DB;
    await db.prepare("DELETE FROM notifications WHERE id = ?").bind(notificationId).run();
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestDelete, "onRequestDelete");
__name2(onRequestDelete, "onRequestDelete");
async function onRequestGet3(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  if (!userId) {
    return new Response("Missing user_id", { status: 400 });
  }
  try {
    const db = env.DB;
    const { results } = await db.prepare(`
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).bind(userId, limit, offset).all();
    const unread = await db.prepare(`
            SELECT COUNT(*) as count FROM notifications 
            WHERE user_id = ? AND is_read = 0
        `).bind(userId).first();
    return new Response(JSON.stringify({
      notifications: results,
      unread_count: unread.count
    }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Expires": "0"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequestGet3, "onRequestGet3");
__name2(onRequestGet3, "onRequestGet");
async function onRequest3(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400
      });
    }
    if (!file.type.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "Only images allowed" }), {
        status: 400
      });
    }
    const extension = file.name.split(".").pop();
    const filename = crypto.randomUUID() + "." + extension;
    await env.BUCKET.put(filename, file, {
      httpMetadata: { contentType: file.type }
    });
    const imageUrl = `/images/${filename}`;
    return new Response(
      JSON.stringify({
        url: imageUrl
        // Отправляем эту ссылку на фронтенд
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
__name(onRequest3, "onRequest3");
__name2(onRequest3, "onRequest");
async function onRequestGet4(context) {
  const { env, params } = context;
  const filename = params.filename;
  if (!filename) {
    return new Response("Filename missing", { status: 400 });
  }
  try {
    const object = await env.BUCKET.get(filename);
    if (!object) {
      return new Response("Image not found", { status: 404 });
    }
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000");
    return new Response(object.body, {
      headers
    });
  } catch (e) {
    return new Response("Error fetching image: " + e.message, { status: 500 });
  }
}
__name(onRequestGet4, "onRequestGet4");
__name2(onRequestGet4, "onRequestGet");
var routes = [
  {
    routePath: "/api/notifications/:id/read",
    mountPath: "/api/notifications/:id",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/promote",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/auth/get_recovery_question",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/login",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/auth/recover",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/auth/register",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/forum/delete",
    mountPath: "/api/forum",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/forum/edit",
    mountPath: "/api/forum",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/forum/like",
    mountPath: "/api/forum",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/forum/solve",
    mountPath: "/api/forum",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/notifications/read-all",
    mountPath: "/api/notifications",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/api/user/get",
    mountPath: "/api/user",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/user/update",
    mountPath: "/api/user",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost11]
  },
  {
    routePath: "/api/forum/topic",
    mountPath: "/api/forum",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/forum/topics",
    mountPath: "/api/forum",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/api/notifications/:id",
    mountPath: "/api/notifications",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/notifications",
    mountPath: "/api/notifications",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/upload",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest3]
  },
  {
    routePath: "/images/:filename",
    mountPath: "/images",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name2(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  static {
    __name(this, "___Facade_ScheduledController__");
  }
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name2(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name2((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name2((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-zEBESC/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-zEBESC/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class ___Facade_ScheduledController__2 {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.5139711062477581.js.map
