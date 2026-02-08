var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../.wrangler/tmp/bundle-AJMH4U/checked-fetch.js
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
var urls;
var init_checked_fetch = __esm({
  "../.wrangler/tmp/bundle-AJMH4U/checked-fetch.js"() {
    urls = /* @__PURE__ */ new Set();
    __name(checkURL, "checkURL");
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply(target, thisArg, argArray) {
        const [request, init] = argArray;
        checkURL(request, init);
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
});

// api/admin/announcements/send.js
async function onRequestPost({ request, env }) {
  try {
    const data = await request.json();
    const { message, title } = data;
    if (!message) {
      return new Response(JSON.stringify({ error: "Message required" }), { status: 400 });
    }
    const { results: users } = await env.DB.prepare("SELECT id FROM users WHERE is_active = 1").all();
    const stmt = env.DB.prepare(`
        INSERT INTO notifications (id, user_id, type, topic_title, created_at) 
        VALUES (?, ?, 'system', ?, CURRENT_TIMESTAMP)
      `);
    const batch = [];
    const BATCH_SIZE = 50;
    for (const user of users) {
      batch.push(stmt.bind(crypto.randomUUID(), user.id, (title || "System Announcement") + ": " + message));
    }
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
var init_send = __esm({
  "api/admin/announcements/send.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost, "onRequestPost");
  }
});

// lib/jwt.js
async function sign(text, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function verify(text, signature, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const binaryString = atob(signature.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    encoder.encode(text)
  );
}
async function generateToken(payload, secret, options = {}) {
  const expiresIn = options.expiresIn || 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const encodedPayload = btoa(JSON.stringify(fullPayload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, secret);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
async function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const isValid = await verify(`${header}.${payload}`, signature, secret);
  if (!isValid) return null;
  try {
    const decodedPayload = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const now = Math.floor(Date.now() / 1e3);
    if (decodedPayload.exp && decodedPayload.exp < now) {
      return null;
    }
    return decodedPayload;
  } catch (e) {
    return null;
  }
}
var init_jwt = __esm({
  "lib/jwt.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(sign, "sign");
    __name(verify, "verify");
    __name(generateToken, "generateToken");
    __name(verifyToken, "verifyToken");
  }
});

// lib/permissions.js
async function hasPermission(env, userId, permissionName) {
  try {
    const user = await env.DB.prepare(
      "SELECT role_id FROM users WHERE id = ?"
    ).bind(userId).first();
    if (!user || !user.role_id) {
      return false;
    }
    const permission = await env.DB.prepare(`
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ? AND p.name = ?
    `).bind(user.role_id, permissionName).first();
    return !!permission;
  } catch (error) {
    console.error("Permission check error:", error);
    return false;
  }
}
async function getUserPermissions(env, userId) {
  try {
    const user = await env.DB.prepare(
      "SELECT role_id FROM users WHERE id = ?"
    ).bind(userId).first();
    if (!user || !user.role_id) {
      return [];
    }
    const permissions = await env.DB.prepare(`
      SELECT p.name FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
    `).bind(user.role_id).all();
    return permissions.results.map((p) => p.name);
  } catch (error) {
    console.error("Get permissions error:", error);
    return [];
  }
}
async function getUserRole(env, userId) {
  try {
    const result = await env.DB.prepare(`
      SELECT r.* FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).bind(userId).first();
    return result || null;
  } catch (error) {
    console.error("Get user role error:", error);
    return null;
  }
}
function requirePermission(permissionName) {
  return async (context, userId) => {
    const { env } = context;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const hasAccess = await hasPermission(env, userId, permissionName);
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
    return null;
  };
}
var init_permissions = __esm({
  "lib/permissions.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(hasPermission, "hasPermission");
    __name(getUserPermissions, "getUserPermissions");
    __name(getUserRole, "getUserRole");
    __name(requirePermission, "requirePermission");
  }
});

// api/admin/roles/assign.js
async function onRequestPost2(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  const adminId = decoded.id;
  const checkPermission = requirePermission("assign_roles");
  const authError = await checkPermission(context, adminId);
  if (authError) return authError;
  try {
    const { user_id, role_id, reason } = await request.json();
    if (!user_id || !role_id) {
      return new Response(JSON.stringify({ error: "User ID and Role ID are required" }), { status: 400 });
    }
    const adminRole = await getUserRole(env, adminId);
    const targetRoleParams = await env.DB.prepare("SELECT level, name FROM roles WHERE id = ?").bind(role_id).first();
    if (!targetRoleParams) {
      return new Response(JSON.stringify({ error: "Invalid role ID" }), { status: 400 });
    }
    if (adminRole.level < targetRoleParams.level && adminRole.name !== "super_admin") {
      return new Response(JSON.stringify({ error: "Cannot assign a role higher than your own" }), { status: 403 });
    }
    await env.DB.prepare("UPDATE users SET role_id = ? WHERE id = ?").bind(role_id, user_id).run();
    await env.DB.prepare(
      "INSERT INTO audit_logs (id, user_id, action, target_entity_type, target_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      crypto.randomUUID(),
      adminId,
      "role_assigned",
      "user",
      user_id,
      JSON.stringify({ old_role: "unknown", new_role: role_id, reason })
    ).run();
    return new Response(JSON.stringify({
      success: true,
      message: `User assigned to ${targetRoleParams.name}`
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_assign = __esm({
  "api/admin/roles/assign.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    __name(onRequestPost2, "onRequestPost");
  }
});

// lib/utils.js
var utils_exports = {};
__export(utils_exports, {
  generateId: () => generateId
});
function generateId() {
  return crypto.randomUUID();
}
var init_utils = __esm({
  "lib/utils.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(generateId, "generateId");
  }
});

// lib/rate-limit.js
async function checkRateLimit(env, identifier, config) {
  const { maxAttempts, windowMinutes, key } = config;
  const rateLimitKey = `ratelimit:${key}:${identifier}`;
  try {
    const kvData = env.RATE_LIMIT_KV ? await env.RATE_LIMIT_KV.get(rateLimitKey, "json") : null;
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1e3;
    if (!kvData || now > kvData.resetAt) {
      const resetAt = now + windowMs;
      if (env.RATE_LIMIT_KV) {
        await env.RATE_LIMIT_KV.put(
          rateLimitKey,
          JSON.stringify({ count: 1, resetAt }),
          { expirationTtl: windowMinutes * 60 }
        );
      }
      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetAt: new Date(resetAt)
      };
    }
    if (kvData.count >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(kvData.resetAt)
      };
    }
    const newCount = kvData.count + 1;
    if (env.RATE_LIMIT_KV) {
      await env.RATE_LIMIT_KV.put(
        rateLimitKey,
        JSON.stringify({ count: newCount, resetAt: kvData.resetAt }),
        { expirationTtl: Math.ceil((kvData.resetAt - now) / 1e3) }
      );
    }
    return {
      allowed: true,
      remaining: maxAttempts - newCount,
      resetAt: new Date(kvData.resetAt)
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    return {
      allowed: true,
      remaining: maxAttempts,
      resetAt: new Date(Date.now() + windowMinutes * 60 * 1e3)
    };
  }
}
function getIpAddress(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0] || "unknown";
}
async function trackLoginAttempt(env, identifier, ipAddress, success, reason = null, userAgent = null) {
  try {
    const { generateId: generateId2 } = await Promise.resolve().then(() => (init_utils(), utils_exports));
    await env.DB.prepare(`
      INSERT INTO login_attempts (
        id, identifier, ip_address, success, failure_reason, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      generateId2(),
      identifier,
      ipAddress,
      success ? 1 : 0,
      reason,
      userAgent
    ).run();
    if (!success) {
      await env.DB.prepare(`
        UPDATE users 
        SET failed_login_attempts = failed_login_attempts + 1
        WHERE email = ? OR username = ?
      `).bind(identifier, identifier).run();
    } else {
      await env.DB.prepare(`
        UPDATE users 
        SET failed_login_attempts = 0, last_login = CURRENT_TIMESTAMP
        WHERE email = ? OR username = ?
      `).bind(identifier, identifier).run();
    }
  } catch (error) {
    console.error("Track login attempt error:", error);
  }
}
async function checkAccountLock(env, identifier) {
  try {
    const user = await env.DB.prepare(`
      SELECT failed_login_attempts, account_locked_until
      FROM users
      WHERE email = ? OR username = ?
    `).bind(identifier, identifier).first();
    if (!user) {
      return { locked: false, lockedUntil: null };
    }
    if (user.account_locked_until) {
      const lockedUntil = new Date(user.account_locked_until);
      if (lockedUntil > /* @__PURE__ */ new Date()) {
        return { locked: true, lockedUntil };
      } else {
        await env.DB.prepare(`
          UPDATE users 
          SET account_locked_until = NULL, failed_login_attempts = 0
          WHERE email = ? OR username = ?
        `).bind(identifier, identifier).run();
        return { locked: false, lockedUntil: null };
      }
    }
    if (user.failed_login_attempts >= 5) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1e3);
      await env.DB.prepare(`
        UPDATE users 
        SET account_locked_until = ?
        WHERE email = ? OR username = ?
      `).bind(lockUntil.toISOString(), identifier, identifier).run();
      return { locked: true, lockedUntil: lockUntil };
    }
    return { locked: false, lockedUntil: null };
  } catch (error) {
    console.error("Check account lock error:", error);
    return { locked: false, lockedUntil: null };
  }
}
var RATE_LIMITS;
var init_rate_limit = __esm({
  "lib/rate-limit.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    RATE_LIMITS = {
      REGISTRATION: {
        maxAttempts: 3,
        windowMinutes: 60,
        key: "reg"
      },
      LOGIN: {
        maxAttempts: 5,
        windowMinutes: 15,
        key: "login"
      },
      PASSWORD_RECOVERY: {
        maxAttempts: 3,
        windowMinutes: 60,
        key: "pwd_recovery"
      },
      API_GENERAL: {
        maxAttempts: 100,
        windowMinutes: 1,
        key: "api"
      },
      VOTE: {
        maxAttempts: 20,
        windowMinutes: 1440,
        // 24 hours
        key: "vote"
      }
    };
    __name(checkRateLimit, "checkRateLimit");
    __name(getIpAddress, "getIpAddress");
    __name(trackLoginAttempt, "trackLoginAttempt");
    __name(checkAccountLock, "checkAccountLock");
  }
});

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
  }
});

// ../node_modules/bcryptjs/index.js
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return import_crypto.default.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
function setRandomFallback(random) {
  randomFallback = random;
}
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4) rounds = 4;
  else if (rounds > 31) rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10) salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function") callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function hashSync(password, salt) {
  if (typeof salt === "undefined") salt = GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof salt === "number") salt = genSaltSync(salt);
  if (typeof password !== "string" || typeof salt !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof salt);
  return _hash(password, salt);
}
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i = 0; i < known.length; ++i) {
    diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
  }
  return diff === 0;
}
function compareSync(password, hash2) {
  if (typeof password !== "string" || typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof hash2);
  if (hash2.length !== 60) return false;
  return safeStringCompare(
    hashSync(password, hash2.substring(0, hash2.length - 31)),
    hash2
  );
}
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err) callback2(err);
        else callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  __name(_async, "_async");
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function getRounds(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  return parseInt(hash2.split("$")[2], 10);
}
function getSalt(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  if (hash2.length !== 60)
    throw Error("Illegal hash length: " + hash2.length + " != 60");
  return hash2.substring(0, 29);
}
function truncates(password) {
  if (typeof password !== "string")
    throw Error("Illegal arguments: " + typeof password);
  return utf8Length(password) > 72;
}
function utf8Length(string) {
  var len = 0, c = 0;
  for (var i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 128) len += 1;
    else if (c < 2048) len += 2;
    else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
      ++i;
      len += 4;
    } else len += 3;
  }
  return len;
}
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i = 0, k = string.length; i < k; ++i) {
    c1 = string.charCodeAt(i);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
function base64_encode(b, len) {
  var off = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
  while (off < len) {
    c1 = b[off++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
function base64_decode(s, len) {
  var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
  if (len <= 0) throw Error("Illegal len: " + len);
  while (off < slen - 1 && olen < len) {
    code = s.charCodeAt(off++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s.charCodeAt(off++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1) break;
    o = c1 << 2 >>> 0;
    o |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = (c2 & 15) << 4 >>> 0;
    o |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = (c3 & 3) << 6 >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
  }
  var res = [];
  for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
  return res;
}
function _encipher(lr, off, P, S) {
  var n, l = lr[off], r = lr[off + 1];
  l ^= P[0];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[2];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[4];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[6];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[8];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[10];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[12];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[14];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[16];
  lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off + 1] = l;
  return lr;
}
function _streamtoword(data, offp) {
  for (var i = 0, word = 0; i < 4; ++i)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
  for (i = 0; i < plen; i += 2)
    lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
  offp = 0;
  for (i = 0; i < plen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback) progressCallback(i / rounds);
    if (i < rounds) {
      var start = Date.now();
      for (; i < rounds; ) {
        i = i + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME) break;
      }
    } else {
      for (i = 0; i < 64; i++)
        for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i = 0; i < clen; i++)
        ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else return ret;
    }
    if (callback) nextTick(next);
  }
  __name(next, "next");
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true) if (typeof (res = next()) !== "undefined") return res || [];
  }
}
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a") res.push(minor);
    res.push("$");
    if (rounds < 10) res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  __name(finish, "finish");
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2) callback(err2, null);
        else callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
function encodeBase64(bytes, length) {
  return base64_encode(bytes, length);
}
function decodeBase64(string, length) {
  return base64_decode(string, length);
}
var import_crypto, randomFallback, nextTick, BASE64_CODE, BASE64_INDEX, BCRYPT_SALT_LEN, GENSALT_DEFAULT_LOG2_ROUNDS, BLOWFISH_NUM_ROUNDS, MAX_EXECUTION_TIME, P_ORIG, S_ORIG, C_ORIG, bcryptjs_default;
var init_bcryptjs = __esm({
  "../node_modules/bcryptjs/index.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    import_crypto = __toESM(require_crypto(), 1);
    randomFallback = null;
    __name(randomBytes, "randomBytes");
    __name(setRandomFallback, "setRandomFallback");
    __name(genSaltSync, "genSaltSync");
    __name(genSalt, "genSalt");
    __name(hashSync, "hashSync");
    __name(hash, "hash");
    __name(safeStringCompare, "safeStringCompare");
    __name(compareSync, "compareSync");
    __name(compare, "compare");
    __name(getRounds, "getRounds");
    __name(getSalt, "getSalt");
    __name(truncates, "truncates");
    nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
    __name(utf8Length, "utf8Length");
    __name(utf8Array, "utf8Array");
    BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
    BASE64_INDEX = [
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      0,
      1,
      54,
      55,
      56,
      57,
      58,
      59,
      60,
      61,
      62,
      63,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      17,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      27,
      -1,
      -1,
      -1,
      -1,
      -1,
      -1,
      28,
      29,
      30,
      31,
      32,
      33,
      34,
      35,
      36,
      37,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      45,
      46,
      47,
      48,
      49,
      50,
      51,
      52,
      53,
      -1,
      -1,
      -1,
      -1,
      -1
    ];
    __name(base64_encode, "base64_encode");
    __name(base64_decode, "base64_decode");
    BCRYPT_SALT_LEN = 16;
    GENSALT_DEFAULT_LOG2_ROUNDS = 10;
    BLOWFISH_NUM_ROUNDS = 16;
    MAX_EXECUTION_TIME = 100;
    P_ORIG = [
      608135816,
      2242054355,
      320440878,
      57701188,
      2752067618,
      698298832,
      137296536,
      3964562569,
      1160258022,
      953160567,
      3193202383,
      887688300,
      3232508343,
      3380367581,
      1065670069,
      3041331479,
      2450970073,
      2306472731
    ];
    S_ORIG = [
      3509652390,
      2564797868,
      805139163,
      3491422135,
      3101798381,
      1780907670,
      3128725573,
      4046225305,
      614570311,
      3012652279,
      134345442,
      2240740374,
      1667834072,
      1901547113,
      2757295779,
      4103290238,
      227898511,
      1921955416,
      1904987480,
      2182433518,
      2069144605,
      3260701109,
      2620446009,
      720527379,
      3318853667,
      677414384,
      3393288472,
      3101374703,
      2390351024,
      1614419982,
      1822297739,
      2954791486,
      3608508353,
      3174124327,
      2024746970,
      1432378464,
      3864339955,
      2857741204,
      1464375394,
      1676153920,
      1439316330,
      715854006,
      3033291828,
      289532110,
      2706671279,
      2087905683,
      3018724369,
      1668267050,
      732546397,
      1947742710,
      3462151702,
      2609353502,
      2950085171,
      1814351708,
      2050118529,
      680887927,
      999245976,
      1800124847,
      3300911131,
      1713906067,
      1641548236,
      4213287313,
      1216130144,
      1575780402,
      4018429277,
      3917837745,
      3693486850,
      3949271944,
      596196993,
      3549867205,
      258830323,
      2213823033,
      772490370,
      2760122372,
      1774776394,
      2652871518,
      566650946,
      4142492826,
      1728879713,
      2882767088,
      1783734482,
      3629395816,
      2517608232,
      2874225571,
      1861159788,
      326777828,
      3124490320,
      2130389656,
      2716951837,
      967770486,
      1724537150,
      2185432712,
      2364442137,
      1164943284,
      2105845187,
      998989502,
      3765401048,
      2244026483,
      1075463327,
      1455516326,
      1322494562,
      910128902,
      469688178,
      1117454909,
      936433444,
      3490320968,
      3675253459,
      1240580251,
      122909385,
      2157517691,
      634681816,
      4142456567,
      3825094682,
      3061402683,
      2540495037,
      79693498,
      3249098678,
      1084186820,
      1583128258,
      426386531,
      1761308591,
      1047286709,
      322548459,
      995290223,
      1845252383,
      2603652396,
      3431023940,
      2942221577,
      3202600964,
      3727903485,
      1712269319,
      422464435,
      3234572375,
      1170764815,
      3523960633,
      3117677531,
      1434042557,
      442511882,
      3600875718,
      1076654713,
      1738483198,
      4213154764,
      2393238008,
      3677496056,
      1014306527,
      4251020053,
      793779912,
      2902807211,
      842905082,
      4246964064,
      1395751752,
      1040244610,
      2656851899,
      3396308128,
      445077038,
      3742853595,
      3577915638,
      679411651,
      2892444358,
      2354009459,
      1767581616,
      3150600392,
      3791627101,
      3102740896,
      284835224,
      4246832056,
      1258075500,
      768725851,
      2589189241,
      3069724005,
      3532540348,
      1274779536,
      3789419226,
      2764799539,
      1660621633,
      3471099624,
      4011903706,
      913787905,
      3497959166,
      737222580,
      2514213453,
      2928710040,
      3937242737,
      1804850592,
      3499020752,
      2949064160,
      2386320175,
      2390070455,
      2415321851,
      4061277028,
      2290661394,
      2416832540,
      1336762016,
      1754252060,
      3520065937,
      3014181293,
      791618072,
      3188594551,
      3933548030,
      2332172193,
      3852520463,
      3043980520,
      413987798,
      3465142937,
      3030929376,
      4245938359,
      2093235073,
      3534596313,
      375366246,
      2157278981,
      2479649556,
      555357303,
      3870105701,
      2008414854,
      3344188149,
      4221384143,
      3956125452,
      2067696032,
      3594591187,
      2921233993,
      2428461,
      544322398,
      577241275,
      1471733935,
      610547355,
      4027169054,
      1432588573,
      1507829418,
      2025931657,
      3646575487,
      545086370,
      48609733,
      2200306550,
      1653985193,
      298326376,
      1316178497,
      3007786442,
      2064951626,
      458293330,
      2589141269,
      3591329599,
      3164325604,
      727753846,
      2179363840,
      146436021,
      1461446943,
      4069977195,
      705550613,
      3059967265,
      3887724982,
      4281599278,
      3313849956,
      1404054877,
      2845806497,
      146425753,
      1854211946,
      1266315497,
      3048417604,
      3681880366,
      3289982499,
      290971e4,
      1235738493,
      2632868024,
      2414719590,
      3970600049,
      1771706367,
      1449415276,
      3266420449,
      422970021,
      1963543593,
      2690192192,
      3826793022,
      1062508698,
      1531092325,
      1804592342,
      2583117782,
      2714934279,
      4024971509,
      1294809318,
      4028980673,
      1289560198,
      2221992742,
      1669523910,
      35572830,
      157838143,
      1052438473,
      1016535060,
      1802137761,
      1753167236,
      1386275462,
      3080475397,
      2857371447,
      1040679964,
      2145300060,
      2390574316,
      1461121720,
      2956646967,
      4031777805,
      4028374788,
      33600511,
      2920084762,
      1018524850,
      629373528,
      3691585981,
      3515945977,
      2091462646,
      2486323059,
      586499841,
      988145025,
      935516892,
      3367335476,
      2599673255,
      2839830854,
      265290510,
      3972581182,
      2759138881,
      3795373465,
      1005194799,
      847297441,
      406762289,
      1314163512,
      1332590856,
      1866599683,
      4127851711,
      750260880,
      613907577,
      1450815602,
      3165620655,
      3734664991,
      3650291728,
      3012275730,
      3704569646,
      1427272223,
      778793252,
      1343938022,
      2676280711,
      2052605720,
      1946737175,
      3164576444,
      3914038668,
      3967478842,
      3682934266,
      1661551462,
      3294938066,
      4011595847,
      840292616,
      3712170807,
      616741398,
      312560963,
      711312465,
      1351876610,
      322626781,
      1910503582,
      271666773,
      2175563734,
      1594956187,
      70604529,
      3617834859,
      1007753275,
      1495573769,
      4069517037,
      2549218298,
      2663038764,
      504708206,
      2263041392,
      3941167025,
      2249088522,
      1514023603,
      1998579484,
      1312622330,
      694541497,
      2582060303,
      2151582166,
      1382467621,
      776784248,
      2618340202,
      3323268794,
      2497899128,
      2784771155,
      503983604,
      4076293799,
      907881277,
      423175695,
      432175456,
      1378068232,
      4145222326,
      3954048622,
      3938656102,
      3820766613,
      2793130115,
      2977904593,
      26017576,
      3274890735,
      3194772133,
      1700274565,
      1756076034,
      4006520079,
      3677328699,
      720338349,
      1533947780,
      354530856,
      688349552,
      3973924725,
      1637815568,
      332179504,
      3949051286,
      53804574,
      2852348879,
      3044236432,
      1282449977,
      3583942155,
      3416972820,
      4006381244,
      1617046695,
      2628476075,
      3002303598,
      1686838959,
      431878346,
      2686675385,
      1700445008,
      1080580658,
      1009431731,
      832498133,
      3223435511,
      2605976345,
      2271191193,
      2516031870,
      1648197032,
      4164389018,
      2548247927,
      300782431,
      375919233,
      238389289,
      3353747414,
      2531188641,
      2019080857,
      1475708069,
      455242339,
      2609103871,
      448939670,
      3451063019,
      1395535956,
      2413381860,
      1841049896,
      1491858159,
      885456874,
      4264095073,
      4001119347,
      1565136089,
      3898914787,
      1108368660,
      540939232,
      1173283510,
      2745871338,
      3681308437,
      4207628240,
      3343053890,
      4016749493,
      1699691293,
      1103962373,
      3625875870,
      2256883143,
      3830138730,
      1031889488,
      3479347698,
      1535977030,
      4236805024,
      3251091107,
      2132092099,
      1774941330,
      1199868427,
      1452454533,
      157007616,
      2904115357,
      342012276,
      595725824,
      1480756522,
      206960106,
      497939518,
      591360097,
      863170706,
      2375253569,
      3596610801,
      1814182875,
      2094937945,
      3421402208,
      1082520231,
      3463918190,
      2785509508,
      435703966,
      3908032597,
      1641649973,
      2842273706,
      3305899714,
      1510255612,
      2148256476,
      2655287854,
      3276092548,
      4258621189,
      236887753,
      3681803219,
      274041037,
      1734335097,
      3815195456,
      3317970021,
      1899903192,
      1026095262,
      4050517792,
      356393447,
      2410691914,
      3873677099,
      3682840055,
      3913112168,
      2491498743,
      4132185628,
      2489919796,
      1091903735,
      1979897079,
      3170134830,
      3567386728,
      3557303409,
      857797738,
      1136121015,
      1342202287,
      507115054,
      2535736646,
      337727348,
      3213592640,
      1301675037,
      2528481711,
      1895095763,
      1721773893,
      3216771564,
      62756741,
      2142006736,
      835421444,
      2531993523,
      1442658625,
      3659876326,
      2882144922,
      676362277,
      1392781812,
      170690266,
      3921047035,
      1759253602,
      3611846912,
      1745797284,
      664899054,
      1329594018,
      3901205900,
      3045908486,
      2062866102,
      2865634940,
      3543621612,
      3464012697,
      1080764994,
      553557557,
      3656615353,
      3996768171,
      991055499,
      499776247,
      1265440854,
      648242737,
      3940784050,
      980351604,
      3713745714,
      1749149687,
      3396870395,
      4211799374,
      3640570775,
      1161844396,
      3125318951,
      1431517754,
      545492359,
      4268468663,
      3499529547,
      1437099964,
      2702547544,
      3433638243,
      2581715763,
      2787789398,
      1060185593,
      1593081372,
      2418618748,
      4260947970,
      69676912,
      2159744348,
      86519011,
      2512459080,
      3838209314,
      1220612927,
      3339683548,
      133810670,
      1090789135,
      1078426020,
      1569222167,
      845107691,
      3583754449,
      4072456591,
      1091646820,
      628848692,
      1613405280,
      3757631651,
      526609435,
      236106946,
      48312990,
      2942717905,
      3402727701,
      1797494240,
      859738849,
      992217954,
      4005476642,
      2243076622,
      3870952857,
      3732016268,
      765654824,
      3490871365,
      2511836413,
      1685915746,
      3888969200,
      1414112111,
      2273134842,
      3281911079,
      4080962846,
      172450625,
      2569994100,
      980381355,
      4109958455,
      2819808352,
      2716589560,
      2568741196,
      3681446669,
      3329971472,
      1835478071,
      660984891,
      3704678404,
      4045999559,
      3422617507,
      3040415634,
      1762651403,
      1719377915,
      3470491036,
      2693910283,
      3642056355,
      3138596744,
      1364962596,
      2073328063,
      1983633131,
      926494387,
      3423689081,
      2150032023,
      4096667949,
      1749200295,
      3328846651,
      309677260,
      2016342300,
      1779581495,
      3079819751,
      111262694,
      1274766160,
      443224088,
      298511866,
      1025883608,
      3806446537,
      1145181785,
      168956806,
      3641502830,
      3584813610,
      1689216846,
      3666258015,
      3200248200,
      1692713982,
      2646376535,
      4042768518,
      1618508792,
      1610833997,
      3523052358,
      4130873264,
      2001055236,
      3610705100,
      2202168115,
      4028541809,
      2961195399,
      1006657119,
      2006996926,
      3186142756,
      1430667929,
      3210227297,
      1314452623,
      4074634658,
      4101304120,
      2273951170,
      1399257539,
      3367210612,
      3027628629,
      1190975929,
      2062231137,
      2333990788,
      2221543033,
      2438960610,
      1181637006,
      548689776,
      2362791313,
      3372408396,
      3104550113,
      3145860560,
      296247880,
      1970579870,
      3078560182,
      3769228297,
      1714227617,
      3291629107,
      3898220290,
      166772364,
      1251581989,
      493813264,
      448347421,
      195405023,
      2709975567,
      677966185,
      3703036547,
      1463355134,
      2715995803,
      1338867538,
      1343315457,
      2802222074,
      2684532164,
      233230375,
      2599980071,
      2000651841,
      3277868038,
      1638401717,
      4028070440,
      3237316320,
      6314154,
      819756386,
      300326615,
      590932579,
      1405279636,
      3267499572,
      3150704214,
      2428286686,
      3959192993,
      3461946742,
      1862657033,
      1266418056,
      963775037,
      2089974820,
      2263052895,
      1917689273,
      448879540,
      3550394620,
      3981727096,
      150775221,
      3627908307,
      1303187396,
      508620638,
      2975983352,
      2726630617,
      1817252668,
      1876281319,
      1457606340,
      908771278,
      3720792119,
      3617206836,
      2455994898,
      1729034894,
      1080033504,
      976866871,
      3556439503,
      2881648439,
      1522871579,
      1555064734,
      1336096578,
      3548522304,
      2579274686,
      3574697629,
      3205460757,
      3593280638,
      3338716283,
      3079412587,
      564236357,
      2993598910,
      1781952180,
      1464380207,
      3163844217,
      3332601554,
      1699332808,
      1393555694,
      1183702653,
      3581086237,
      1288719814,
      691649499,
      2847557200,
      2895455976,
      3193889540,
      2717570544,
      1781354906,
      1676643554,
      2592534050,
      3230253752,
      1126444790,
      2770207658,
      2633158820,
      2210423226,
      2615765581,
      2414155088,
      3127139286,
      673620729,
      2805611233,
      1269405062,
      4015350505,
      3341807571,
      4149409754,
      1057255273,
      2012875353,
      2162469141,
      2276492801,
      2601117357,
      993977747,
      3918593370,
      2654263191,
      753973209,
      36408145,
      2530585658,
      25011837,
      3520020182,
      2088578344,
      530523599,
      2918365339,
      1524020338,
      1518925132,
      3760827505,
      3759777254,
      1202760957,
      3985898139,
      3906192525,
      674977740,
      4174734889,
      2031300136,
      2019492241,
      3983892565,
      4153806404,
      3822280332,
      352677332,
      2297720250,
      60907813,
      90501309,
      3286998549,
      1016092578,
      2535922412,
      2839152426,
      457141659,
      509813237,
      4120667899,
      652014361,
      1966332200,
      2975202805,
      55981186,
      2327461051,
      676427537,
      3255491064,
      2882294119,
      3433927263,
      1307055953,
      942726286,
      933058658,
      2468411793,
      3933900994,
      4215176142,
      1361170020,
      2001714738,
      2830558078,
      3274259782,
      1222529897,
      1679025792,
      2729314320,
      3714953764,
      1770335741,
      151462246,
      3013232138,
      1682292957,
      1483529935,
      471910574,
      1539241949,
      458788160,
      3436315007,
      1807016891,
      3718408830,
      978976581,
      1043663428,
      3165965781,
      1927990952,
      4200891579,
      2372276910,
      3208408903,
      3533431907,
      1412390302,
      2931980059,
      4132332400,
      1947078029,
      3881505623,
      4168226417,
      2941484381,
      1077988104,
      1320477388,
      886195818,
      18198404,
      3786409e3,
      2509781533,
      112762804,
      3463356488,
      1866414978,
      891333506,
      18488651,
      661792760,
      1628790961,
      3885187036,
      3141171499,
      876946877,
      2693282273,
      1372485963,
      791857591,
      2686433993,
      3759982718,
      3167212022,
      3472953795,
      2716379847,
      445679433,
      3561995674,
      3504004811,
      3574258232,
      54117162,
      3331405415,
      2381918588,
      3769707343,
      4154350007,
      1140177722,
      4074052095,
      668550556,
      3214352940,
      367459370,
      261225585,
      2610173221,
      4209349473,
      3468074219,
      3265815641,
      314222801,
      3066103646,
      3808782860,
      282218597,
      3406013506,
      3773591054,
      379116347,
      1285071038,
      846784868,
      2669647154,
      3771962079,
      3550491691,
      2305946142,
      453669953,
      1268987020,
      3317592352,
      3279303384,
      3744833421,
      2610507566,
      3859509063,
      266596637,
      3847019092,
      517658769,
      3462560207,
      3443424879,
      370717030,
      4247526661,
      2224018117,
      4143653529,
      4112773975,
      2788324899,
      2477274417,
      1456262402,
      2901442914,
      1517677493,
      1846949527,
      2295493580,
      3734397586,
      2176403920,
      1280348187,
      1908823572,
      3871786941,
      846861322,
      1172426758,
      3287448474,
      3383383037,
      1655181056,
      3139813346,
      901632758,
      1897031941,
      2986607138,
      3066810236,
      3447102507,
      1393639104,
      373351379,
      950779232,
      625454576,
      3124240540,
      4148612726,
      2007998917,
      544563296,
      2244738638,
      2330496472,
      2058025392,
      1291430526,
      424198748,
      50039436,
      29584100,
      3605783033,
      2429876329,
      2791104160,
      1057563949,
      3255363231,
      3075367218,
      3463963227,
      1469046755,
      985887462
    ];
    C_ORIG = [
      1332899944,
      1700884034,
      1701343084,
      1684370003,
      1668446532,
      1869963892
    ];
    __name(_encipher, "_encipher");
    __name(_streamtoword, "_streamtoword");
    __name(_key, "_key");
    __name(_ekskey, "_ekskey");
    __name(_crypt, "_crypt");
    __name(_hash, "_hash");
    __name(encodeBase64, "encodeBase64");
    __name(decodeBase64, "decodeBase64");
    bcryptjs_default = {
      setRandomFallback,
      genSaltSync,
      genSalt,
      hashSync,
      hash,
      compareSync,
      compare,
      getRounds,
      getSalt,
      truncates,
      encodeBase64,
      decodeBase64
    };
  }
});

// lib/crypto.js
async function hashPassword(password) {
  const saltRounds = 12;
  return await bcryptjs_default.hash(password, saltRounds);
}
async function verifyPassword(password, storedHash) {
  return await bcryptjs_default.compare(password, storedHash);
}
async function hashSecurityAnswer(answer) {
  const normalized = answer.trim().toLowerCase();
  return await hashPassword(normalized);
}
async function verifySecurityAnswer(answer, storedHash) {
  const normalized = answer.trim().toLowerCase();
  return await verifyPassword(normalized, storedHash);
}
function generateToken2(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function validatePasswordStrength(password) {
  const errors = [];
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
var init_crypto = __esm({
  "lib/crypto.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_bcryptjs();
    __name(hashPassword, "hashPassword");
    __name(verifyPassword, "verifyPassword");
    __name(hashSecurityAnswer, "hashSecurityAnswer");
    __name(verifySecurityAnswer, "verifySecurityAnswer");
    __name(generateToken2, "generateToken");
    __name(validatePasswordStrength, "validatePasswordStrength");
  }
});

// lib/audit.js
async function logAudit(env, params) {
  const {
    userId,
    action,
    targetEntityType = null,
    targetEntityId = null,
    targetUserId = null,
    details = null,
    ipAddress = null,
    userAgent = null
  } = params;
  try {
    await env.DB.prepare(`
      INSERT INTO audit_logs (
        id, user_id, action, target_entity_type, target_entity_id,
        target_user_id, details, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      userId,
      action,
      targetEntityType,
      targetEntityId,
      targetUserId,
      details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent
    ).run();
  } catch (error) {
    console.error("Audit log error:", error);
  }
}
var AUDIT_ACTIONS;
var init_audit = __esm({
  "lib/audit.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_utils();
    __name(logAudit, "logAudit");
    AUDIT_ACTIONS = {
      // User management
      USER_REGISTERED: "user_registered",
      USER_LOGIN: "user_login",
      USER_LOGOUT: "user_logout",
      USER_BANNED: "user_banned",
      USER_UNBANNED: "user_unbanned",
      USER_DELETED: "user_deleted",
      // Role management
      ROLE_ASSIGNED: "role_assigned",
      ROLE_REMOVED: "role_removed",
      // Content moderation
      POST_DELETED: "post_deleted",
      POST_EDITED_BY_MOD: "post_edited_by_moderator",
      TOPIC_LOCKED: "topic_locked",
      TOPIC_UNLOCKED: "topic_unlocked",
      TOPIC_PINNED: "topic_pinned",
      TOPIC_UNPINNED: "topic_unpinned",
      TOPIC_ARCHIVED: "topic_archived",
      // Warnings and reports
      WARNING_ISSUED: "warning_issued",
      WARNING_REMOVED: "warning_removed",
      REPORT_CREATED: "report_created",
      REPORT_RESOLVED: "report_resolved",
      // Reputation
      REPUTATION_ADJUSTED: "reputation_adjusted",
      // System
      SETTINGS_CHANGED: "settings_changed",
      PERMISSION_CHANGED: "permission_changed"
    };
  }
});

// api/auth/password-recovery/init.js
async function onRequestPost3(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  try {
    const rateLimit = await checkRateLimit(env, ipAddress, RATE_LIMITS.PASSWORD_RECOVERY);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: "Too many recovery attempts. Please try again later.",
        resetAt: rateLimit.resetAt.toISOString()
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((rateLimit.resetAt - /* @__PURE__ */ new Date()) / 1e3).toString()
        }
      });
    }
    const { identifier } = await request.json();
    if (!identifier) {
      return new Response(JSON.stringify({ error: "Email or username is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const user = await env.DB.prepare(
      "SELECT id, security_question FROM users WHERE email = ? OR username = ?"
    ).bind(identifier, identifier).first();
    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return new Response(JSON.stringify({ error: "User not found" }), {
        // Or generic message
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!user.security_question) {
      return new Response(JSON.stringify({
        error: "Security question not set for this account. Please contact support."
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const recoveryToken = generateToken2(32);
    await env.DB.prepare(
      "UPDATE users SET verification_token = ? WHERE id = ?"
    ).bind(recoveryToken, user.id).run();
    return new Response(JSON.stringify({
      success: true,
      security_question: user.security_question,
      recovery_token: recoveryToken
      // Client sends this back with the answer
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Recovery Init Error:", e);
    return new Response(JSON.stringify({ error: "Failed to initiate recovery" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
var init_init = __esm({
  "api/auth/password-recovery/init.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_rate_limit();
    init_crypto();
    init_audit();
    __name(onRequestPost3, "onRequestPost");
  }
});

// api/auth/password-recovery/reset.js
async function onRequestPost4(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  try {
    const { reset_token, new_password } = await request.json();
    if (!reset_token || !new_password) {
      return new Response(JSON.stringify({ error: "Missing token or password" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const passwordValidation = validatePasswordStrength(new_password);
    if (!passwordValidation.valid) {
      return new Response(JSON.stringify({
        error: "Password too weak",
        details: passwordValidation.errors
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const user = await env.DB.prepare(
      "SELECT id, email FROM users WHERE verification_token = ?"
    ).bind(reset_token).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid or expired reset token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const newHash = await hashPassword(new_password);
    await env.DB.prepare(
      "UPDATE users SET password_hash = ?, verification_token = NULL WHERE id = ?"
    ).bind(newHash, user.id).run();
    await logAudit(env, {
      userId: user.id,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      targetEntityType: "user",
      targetEntityId: user.id,
      details: {
        change: "password_reset_recovery",
        ip: ipAddress
      },
      ipAddress,
      userAgent: request.headers.get("User-Agent")
    });
    return new Response(JSON.stringify({
      success: true,
      message: "Password successfully reset"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Reset Error:", e);
    return new Response(JSON.stringify({ error: "Password reset failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
var init_reset = __esm({
  "api/auth/password-recovery/reset.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_crypto();
    init_audit();
    init_rate_limit();
    __name(onRequestPost4, "onRequestPost");
  }
});

// api/auth/password-recovery/verify.js
async function onRequestPost5(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  try {
    const rateLimit = await checkRateLimit(env, ipAddress, RATE_LIMITS.PASSWORD_RECOVERY);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: "Too many attempts. Please try again later.",
        resetAt: rateLimit.resetAt.toISOString()
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((rateLimit.resetAt - /* @__PURE__ */ new Date()) / 1e3).toString()
        }
      });
    }
    const { recovery_token, security_answer } = await request.json();
    if (!recovery_token || !security_answer) {
      return new Response(JSON.stringify({ error: "Missing token or answer" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const user = await env.DB.prepare(
      "SELECT id, security_answer_hash FROM users WHERE verification_token = ?"
    ).bind(recovery_token).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid or expired recovery token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const isValid = await verifySecurityAnswer(security_answer, user.security_answer_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Incorrect answer" }), {
        status: 400,
        // Or 401
        headers: { "Content-Type": "application/json" }
      });
    }
    const resetToken = generateToken2(64);
    await env.DB.prepare(
      "UPDATE users SET verification_token = ? WHERE id = ?"
    ).bind(resetToken, user.id).run();
    return new Response(JSON.stringify({
      success: true,
      reset_token: resetToken
      // Used in Step 3
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Verify Error:", e);
    return new Response(JSON.stringify({ error: "Verification failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
var init_verify = __esm({
  "api/auth/password-recovery/verify.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_crypto();
    init_rate_limit();
    __name(onRequestPost5, "onRequestPost");
  }
});

// api/admin/users/[id].js
async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    const userId = parts[parts.length - 1];
    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID required" }), { status: 400 });
    }
    const user = await env.DB.prepare(`
        SELECT id, username, email, role_id, created_at, last_login, is_active, reputation, failed_login_attempts
        FROM users WHERE id = ?
      `).bind(userId).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }
    const { results: logins } = await env.DB.prepare(`
        SELECT ip_address, created_at, success, failure_reason 
        FROM login_attempts 
        WHERE identifier = ? OR identifier = ?
        ORDER BY created_at DESC LIMIT 10
      `).bind(user.email, user.username).all();
    const { results: warnings } = await env.DB.prepare(`
        SELECT reason, severity, created_at 
        FROM warnings 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).bind(userId).all();
    const { results: reputation } = await env.DB.prepare(`
        SELECT change_amount, reason, created_at 
        FROM reputation_history 
        WHERE user_id = ? 
        ORDER BY created_at DESC LIMIT 10
      `).bind(userId).all();
    return new Response(JSON.stringify({
      success: true,
      user,
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
var init_id = __esm({
  "api/admin/users/[id].js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestGet, "onRequestGet");
  }
});

// api/notifications/[id]/read.js
async function onRequestPost6(context) {
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
var init_read = __esm({
  "api/notifications/[id]/read.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost6, "onRequestPost");
  }
});

// api/admin/analytics.js
async function onRequestGet2({ request, env }) {
  try {
    const url = new URL(request.url);
    const { results: pageViews } = await env.DB.prepare(`
        SELECT strftime('%H:00', created_at) as hour, COUNT(*) as count 
        FROM analytics_events 
        WHERE created_at > datetime('now', '-24 hours') 
        GROUP BY hour 
        ORDER BY hour ASC
      `).all();
    const activeUsers = await env.DB.prepare(`
        SELECT COUNT(DISTINCT ip_address) as count 
        FROM analytics_events 
        WHERE created_at > datetime('now', '-15 minutes')
      `).first("count");
    const { results: topPages } = await env.DB.prepare(`
        SELECT path, COUNT(*) as count 
        FROM analytics_events 
        WHERE created_at > datetime('now', '-24 hours') 
        GROUP BY path 
        ORDER BY count DESC 
        LIMIT 5
      `).all();
    const { results: devices } = await env.DB.prepare(`
        SELECT device_type, COUNT(*) as count 
        FROM analytics_events 
        WHERE created_at > datetime('now', '-24 hours') 
        GROUP BY device_type
      `).all();
    return new Response(JSON.stringify({
      success: true,
      data: {
        pageViews,
        activeUsers,
        topPages,
        devices
      }
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_analytics = __esm({
  "api/admin/analytics.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestGet2, "onRequestGet");
  }
});

// api/admin/ban.js
async function onRequestPost7(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const secret = env.JWT_SECRET || "secret-dev-key";
  const decoded = await verifyToken(token, secret);
  if (!decoded) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401 });
  }
  const adminId = decoded.id;
  const checkPermission = requirePermission("ban_user");
  const errorResponse = await checkPermission(context, adminId);
  if (errorResponse) return errorResponse;
  try {
    const { user_id, reason, duration_hours } = await request.json();
    if (!user_id || !reason) {
      return new Response(JSON.stringify({ error: "User ID and reason required" }), { status: 400 });
    }
    if (user_id === adminId) {
      return new Response(JSON.stringify({ error: "Cannot ban yourself" }), { status: 400 });
    }
    const targetUser = await env.DB.prepare("SELECT role_id FROM users WHERE id = ?").bind(user_id).first();
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }
    const adminRole = await env.DB.prepare("SELECT level FROM roles WHERE id = (SELECT role_id FROM users WHERE id = ?)").bind(adminId).first();
    const targetRole = await env.DB.prepare("SELECT level FROM roles WHERE id = ?").bind(targetUser.role_id).first();
    if (targetRole && adminRole && targetRole.level >= adminRole.level) {
      return new Response(JSON.stringify({ error: "Cannot ban user with equal or higher role" }), { status: 403 });
    }
    await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?").bind(user_id).run();
    await logAudit(env, {
      userId: adminId,
      action: AUDIT_ACTIONS.USER_BANNED,
      targetEntityType: "user",
      targetEntityId: user_id,
      targetUserId: user_id,
      details: { reason, duration: "permanent" },
      ipAddress: getIpAddress(request)
    });
    return new Response(JSON.stringify({ success: true, message: "User banned successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_ban = __esm({
  "api/admin/ban.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    init_audit();
    init_rate_limit();
    __name(onRequestPost7, "onRequestPost");
  }
});

// api/admin/logs.js
async function onRequestGet3(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  const userId = decoded.id;
  const checkPermission = requirePermission("view_audit_logs");
  const authError = await checkPermission(context, userId);
  if (authError) return authError;
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit")) || 50;
    const offset = parseInt(url.searchParams.get("offset")) || 0;
    const query = `
            SELECT l.*, u.username as actor_username 
            FROM audit_logs l
            LEFT JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC 
            LIMIT ? OFFSET ?
        `;
    const { results } = await env.DB.prepare(query).bind(limit, offset).all();
    return new Response(JSON.stringify({
      success: true,
      logs: results
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_logs = __esm({
  "api/admin/logs.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    __name(onRequestGet3, "onRequestGet");
  }
});

// api/admin/promote.js
async function onRequestGet4(context) {
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
var init_promote = __esm({
  "api/admin/promote.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestGet4, "onRequestGet");
  }
});

// api/admin/settings.js
async function onRequestGet5({ request, env }) {
  try {
    const token = request.headers.get("Authorization");
    const { results } = await env.DB.prepare("SELECT key, value FROM system_settings").all();
    const settings = {};
    results.forEach((row) => {
      settings[row.key] = row.value;
    });
    const defaults = {
      site_name: "BMW Diagnostic Codes",
      maintenance_mode: "false",
      registrations_open: "true",
      announcement_banner: "",
      announcement_active: "false",
      default_lang: "en"
    };
    return new Response(JSON.stringify({
      success: true,
      settings: { ...defaults, ...settings }
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
async function onRequestPost8({ request, env }) {
  try {
    const data = await request.json();
    const stmt = env.DB.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)");
    const batch = [];
    for (const [key, value] of Object.entries(data)) {
      batch.push(stmt.bind(key, String(value)));
    }
    await env.DB.batch(batch);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_settings = __esm({
  "api/admin/settings.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestGet5, "onRequestGet");
    __name(onRequestPost8, "onRequestPost");
  }
});

// api/admin/stats.js
async function onRequestGet6(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  const userId = decoded.id;
  const checkPermission = requirePermission("view_user_details");
  const authError = await checkPermission(context, userId);
  if (authError) return authError;
  try {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      pendingReports,
      totalTopics,
      totalPosts
    ] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as count FROM users").first("count"),
      env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE is_active = 1").first("count"),
      env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role_id = 'banned' OR is_active = 0").first("count"),
      env.DB.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'").first("count"),
      env.DB.prepare("SELECT COUNT(*) as count FROM topics").first("count"),
      env.DB.prepare("SELECT COUNT(*) as count FROM posts").first("count")
    ]);
    return new Response(JSON.stringify({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          active: activeUsers,
          banned: bannedUsers
        },
        content: {
          topics: totalTopics,
          posts: totalPosts
        },
        moderation: {
          pending_reports: pendingReports
        }
      }
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_stats = __esm({
  "api/admin/stats.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    __name(onRequestGet6, "onRequestGet");
  }
});

// api/admin/unban.js
async function onRequestPost9(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response("Invalid token", { status: 401 });
  const adminId = decoded.id;
  const allowed = await hasPermission(env, adminId, "ban_user");
  if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  try {
    const { user_id, reason } = await request.json();
    if (!user_id) return new Response("Missing user_id", { status: 400 });
    await env.DB.prepare("UPDATE users SET is_active = 1 WHERE id = ?").bind(user_id).run();
    await logAudit(env, {
      userId: adminId,
      action: "user_unbanned",
      targetEntityType: "user",
      targetEntityId: user_id,
      targetUserId: user_id,
      details: { reason },
      ipAddress: request.headers.get("CF-Connecting-IP") || "127.0.0.1",
      userAgent: request.headers.get("User-Agent")
    });
    return new Response(JSON.stringify({ success: true, message: "User unbanned" }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_unban = __esm({
  "api/admin/unban.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    init_audit();
    __name(onRequestPost9, "onRequestPost");
  }
});

// api/admin/users.js
async function onRequestGet7(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  console.log("Admin API: Auth Header:", authHeader);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Admin API: No valid auth header");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const secret = env.JWT_SECRET || "secret-dev-key";
  console.log("Admin API: Verifying token with secret length:", secret.length);
  const decoded = await verifyToken(token, secret);
  console.log("Admin API: Decoded:", decoded);
  if (!decoded) {
    console.log("Admin API: Token verification failed");
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401 });
  }
  const userId = decoded.id;
  const checkPermission = requirePermission("view_user_details");
  const errorResponse = await checkPermission(context, userId);
  if (errorResponse) return errorResponse;
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit")) || 20;
    const offset = parseInt(url.searchParams.get("offset")) || 0;
    const search = url.searchParams.get("search");
    const roleFilter = url.searchParams.get("role");
    let query = `
        SELECT 
            id, username, email, first_name, last_name, 
            role_id, reputation, created_at, last_login, is_active 
        FROM users
      `;
    let whereClauses = [];
    let params = [];
    if (roleFilter) {
      if (roleFilter === "banned") {
        whereClauses.push("is_active = 0");
      } else {
        whereClauses.push("role_id = ?");
        params.push(roleFilter);
      }
    }
    if (search) {
      const searchLower = search.toLowerCase();
      let searchConditions = [];
      searchConditions.push("username LIKE ?");
      params.push(`%${search}%`);
      searchConditions.push("email LIKE ?");
      params.push(`%${search}%`);
      searchConditions.push("role_id LIKE ?");
      params.push(`%${search}%`);
      if (searchLower.includes("ban") || searchLower.includes("block")) {
        searchConditions.push("is_active = 0");
      }
      if (searchLower.includes("active")) {
        searchConditions.push("is_active = 1");
      }
      whereClauses.push(`(${searchConditions.join(" OR ")})`);
    }
    if (whereClauses.length > 0) {
      query += " WHERE " + whereClauses.join(" AND ");
    }
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const { results } = await env.DB.prepare(query).bind(...params).all();
    let countQuery = "SELECT COUNT(*) as total FROM users";
    let countParams = [];
    if (whereClauses.length > 0) {
      countQuery += " WHERE " + whereClauses.join(" AND ");
      countParams = params.slice(0, params.length - 2);
    }
    const total = await env.DB.prepare(countQuery).bind(...countParams).first("total");
    return new Response(JSON.stringify({
      success: true,
      users: results,
      pagination: {
        total,
        limit,
        offset
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_users = __esm({
  "api/admin/users.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    __name(onRequestGet7, "onRequestGet");
  }
});

// api/analytics/track.js
async function onRequestPost10({ request, env }) {
  try {
    const data = await request.json();
    const { user_id, event_type, path, referrer, user_agent, device_type, meta } = data;
    const ip = request.headers.get("CF-Connecting-IP") || "127.0.0.1";
    const country = request.headers.get("CF-IPCountry") || "Unknown";
    await env.DB.prepare(`
      INSERT INTO analytics_events (user_id, event_type, path, referrer, user_agent, ip_address, country, device_type, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user_id || null,
      event_type || "page_view",
      path,
      referrer,
      user_agent,
      ip,
      country,
      device_type,
      meta ? JSON.stringify(meta) : null
    ).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_track = __esm({
  "api/analytics/track.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost10, "onRequestPost");
  }
});

// api/auth/get_recovery_question.js
async function onRequestPost11(context) {
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
var init_get_recovery_question = __esm({
  "api/auth/get_recovery_question.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost11, "onRequestPost");
  }
});

// lib/reputation.js
async function getUserLevel(env, reputation, lang = "en") {
  const levels = await env.DB.prepare(`
    SELECT * FROM user_levels 
    ORDER BY min_reputation DESC
  `).all();
  const results = levels.results;
  const level = results.find((l) => reputation >= l.min_reputation) || results[results.length - 1];
  if (!level) return null;
  let levelName = level.name;
  if (lang === "ru" && level.name_ru) levelName = level.name_ru;
  if (lang === "ka" && level.name_ka) levelName = level.name_ka;
  if (lang === "en" && level.name_en) levelName = level.name_en;
  return {
    id: level.id,
    name: levelName,
    color: level.color,
    benefits: level.benefits ? JSON.parse(level.benefits) : {}
  };
}
async function addReputation(env, userId, amount, reason, details = {}) {
  try {
    const historyId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO reputation_history (id, user_id, change_amount, reason, related_entity_type, related_entity_id, moderator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      historyId,
      userId,
      amount,
      reason,
      details.entityType || null,
      details.entityId || null,
      details.moderatorId || null
    ).run();
    await env.DB.prepare(`
      UPDATE users SET reputation = reputation + ? WHERE id = ?
    `).bind(amount, userId).run();
    return true;
  } catch (error) {
    console.error("Error adding reputation:", error);
    return false;
  }
}
async function canVote(env, userId, targetUserId, postId) {
  if (userId === targetUserId) {
    return { allowed: false, error: "Cannot vote on your own content" };
  }
  const user = await env.DB.prepare("SELECT reputation FROM users WHERE id = ?").bind(userId).first();
  if (!user) return { allowed: false, error: "User not found" };
  const level = await getUserLevel(env, user.reputation || 0);
  if (!level || !level.benefits.can_vote) {
    return { allowed: false, error: "Your reputation level does not allow voting yet" };
  }
  const existing = await env.DB.prepare(`
    SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?
  `).bind(userId, postId).first();
  if (existing) {
    return { allowed: false, error: "Already voted" };
  }
  const dailyLimit = level.benefits.max_uploads_per_day || 20;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const count = await env.DB.prepare(`
    SELECT COUNT(*) as c FROM post_likes 
    WHERE user_id = ? AND date(created_at) = ?
  `).bind(userId, today).first("c");
  if (count >= dailyLimit) {
    return { allowed: false, error: "Daily vote limit reached" };
  }
  return { allowed: true, voteWeight: level.benefits.vote_weight || 1 };
}
var init_reputation = __esm({
  "lib/reputation.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(getUserLevel, "getUserLevel");
    __name(addReputation, "addReputation");
    __name(canVote, "canVote");
  }
});

// api/auth/login.js
async function onRequestPost12(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  const userAgent = request.headers.get("User-Agent");
  try {
    const rateLimit = await checkRateLimit(env, ipAddress, RATE_LIMITS.LOGIN);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: "Too many login attempts. Please try again later.",
        resetAt: rateLimit.resetAt.toISOString()
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((rateLimit.resetAt - /* @__PURE__ */ new Date()) / 1e3).toString()
        }
      });
    }
    const { email, password, remember_me } = await request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Username/Email and password are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const lockStatus = await checkAccountLock(env, email);
    if (lockStatus.locked) {
      const remainingMinutes = Math.ceil((lockStatus.lockedUntil - /* @__PURE__ */ new Date()) / 6e4);
      await trackLoginAttempt(env, email, ipAddress, false, "account_locked", userAgent);
      return new Response(JSON.stringify({
        error: `Account is temporarily locked due to multiple failed attempts. Please try again in ${remainingMinutes} minutes.`
      }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
    const user = await env.DB.prepare(
      "SELECT * FROM users WHERE email = ? OR username = ?"
    ).bind(email, email).first();
    if (!user) {
      await trackLoginAttempt(env, email, ipAddress, false, "user_not_found", userAgent);
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      await trackLoginAttempt(env, email, ipAddress, false, "invalid_password", userAgent);
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!user.is_active) {
      await trackLoginAttempt(env, email, ipAddress, false, "account_disabled", userAgent);
      return new Response(JSON.stringify({ error: "Account is disabled. Please contact support." }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
    await trackLoginAttempt(env, email, ipAddress, true, null, userAgent);
    await logAudit(env, {
      userId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      targetEntityType: "user",
      targetEntityId: user.id,
      targetUserId: user.id,
      details: {
        method: email.includes("@") ? "email" : "username",
        ip: ipAddress
      },
      ipAddress,
      userAgent
    });
    const permissions = await getUserPermissions(env, user.id);
    const role = await getUserRole(env, user.id);
    const level = await getUserLevel(env, user.reputation || 0, user.preferred_lang || "en");
    const secret = env.JWT_SECRET || "secret-dev-key";
    const expirationSeconds = remember_me ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
    const token = await generateToken(
      {
        id: user.id,
        username: user.username,
        role: role?.name || "user",
        role_level: role?.level || 1,
        permissions
      },
      secret,
      { expiresIn: expirationSeconds }
    );
    await env.DB.prepare(
      "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(user.id).run();
    return new Response(
      JSON.stringify({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          age: user.age,
          avatar_url: user.avatar_url,
          lang: user.preferred_lang,
          role: role?.name || "user",
          role_display: role?.display_name || "User",
          bio: user.bio,
          car_model: user.car_model,
          reputation: user.reputation || 0,
          level,
          permissions
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Login Error:", e);
    return new Response(JSON.stringify({ error: "Login failed. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
var init_login = __esm({
  "api/auth/login.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_crypto();
    init_rate_limit();
    init_audit();
    init_permissions();
    init_reputation();
    __name(onRequestPost12, "onRequestPost");
  }
});

// api/auth/recover.js
async function onRequestPost13(context) {
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
var init_recover = __esm({
  "api/auth/recover.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_crypto();
    __name(onRequestPost13, "onRequestPost");
  }
});

// api/auth/register.js
async function onRequestPost14(context) {
  const { request, env } = context;
  try {
    const body = await request.clone().json();
    const {
      email,
      username,
      password,
      first_name,
      last_name,
      age,
      security_question,
      security_answer,
      language
    } = body;
    const ipAddress = getIpAddress(request);
    const rateLimit = await checkRateLimit(env, ipAddress, RATE_LIMITS.REGISTRATION);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({
        error: "Too many registration attempts. Please try again later.",
        resetAt: rateLimit.resetAt.toISOString()
      }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": Math.ceil((rateLimit.resetAt - /* @__PURE__ */ new Date()) / 1e3).toString()
        }
      });
    }
    if (!email || !username || !password || !security_question || !security_answer) {
      return new Response(JSON.stringify({
        error: "Missing required fields",
        required: ["email", "username", "password", "security_question", "security_answer"]
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({
        error: "Invalid email format"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return new Response(JSON.stringify({
        error: "Username must be 3-20 characters (letters, numbers, underscore only)"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return new Response(JSON.stringify({
        error: "Password does not meet requirements",
        details: passwordValidation.errors
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (age && (age < 13 || age > 120)) {
      return new Response(JSON.stringify({
        error: "Age must be between 13 and 120"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ? OR username = ?"
    ).bind(email, username).first();
    if (existing) {
      return new Response(JSON.stringify({
        error: "Email or username already exists"
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }
    const userId = generateId();
    const passwordHash = await hashPassword(password);
    const answerHash = await hashSecurityAnswer(security_answer);
    await env.DB.prepare(`
      INSERT INTO users (
        id, email, username, password_hash, 
        role_id, preferred_lang,
        security_question, security_answer_hash,
        first_name, last_name, age,
        reputation, is_active, email_verified,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      userId,
      email,
      username,
      passwordHash,
      "user_role",
      // Default role
      language || "en",
      security_question,
      answerHash,
      first_name || null,
      last_name || null,
      age || null,
      0,
      // Initial reputation
      1,
      // Active
      0
      // Email not verified
    ).run();
    await logAudit(env, {
      userId,
      action: AUDIT_ACTIONS.USER_REGISTERED,
      targetEntityType: "user",
      targetEntityId: userId,
      targetUserId: userId,
      details: {
        username,
        email,
        registrationIp: ipAddress
      },
      ipAddress,
      userAgent: request.headers.get("User-Agent")
    });
    return new Response(JSON.stringify({
      success: true,
      user: {
        id: userId,
        username,
        email
      }
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Registration error:", error);
    return new Response(JSON.stringify({
      error: "Registration failed. Please try again."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
var init_register = __esm({
  "api/auth/register.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_utils();
    init_crypto();
    init_rate_limit();
    init_audit();
    __name(onRequestPost14, "onRequestPost");
  }
});

// api/forum/delete.js
async function onRequestPost15(context) {
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
var init_delete = __esm({
  "api/forum/delete.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost15, "onRequestPost");
  }
});

// api/forum/edit.js
async function onRequestPost16(context) {
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
var init_edit = __esm({
  "api/forum/edit.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost16, "onRequestPost");
  }
});

// api/forum/like.js
async function onRequestPost17(context) {
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
var init_like = __esm({
  "api/forum/like.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost17, "onRequestPost");
  }
});

// api/forum/solve.js
async function onRequestPost18(context) {
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
var init_solve = __esm({
  "api/forum/solve.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost18, "onRequestPost");
  }
});

// api/moderation/list_reports.js
async function onRequestGet8(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  const allowed = await hasPermission(env, decoded.id, "view_reports");
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "pending";
    const limit = url.searchParams.get("limit") || 20;
    const offset = url.searchParams.get("offset") || 0;
    const results = await env.DB.prepare(`
        SELECT reports.*, 
               reporter.username as reporter_username,
               reported.username as reported_username
        FROM reports
        LEFT JOIN users as reporter ON reports.reporter_id = reporter.id
        LEFT JOIN users as reported ON reports.reported_user_id = reported.id
        WHERE status = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all();
    return new Response(JSON.stringify({ success: true, reports: results.results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_list_reports = __esm({
  "api/moderation/list_reports.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    __name(onRequestGet8, "onRequestGet");
  }
});

// api/moderation/report.js
async function onRequestPost19(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  const reporterId = decoded.id;
  try {
    const { entity_type, entity_id, reason, description, reported_user_id } = await request.json();
    if (!entity_type || !entity_id || !reason) {
      return new Response(JSON.stringify({ error: "Missing required fields: entity_type, entity_id, reason" }), { status: 400 });
    }
    const reportId = crypto.randomUUID();
    await env.DB.prepare(`
        INSERT INTO reports (id, reporter_id, reported_entity_type, reported_entity_id, reported_user_id, reason, description)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(reportId, reporterId, entity_type, entity_id, reported_user_id || null, reason, description || null).run();
    return new Response(JSON.stringify({ success: true, message: "Report submitted successfully", report_id: reportId }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_report = __esm({
  "api/moderation/report.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    __name(onRequestPost19, "onRequestPost");
  }
});

// api/moderation/reports.js
async function onRequestGet9({ request, env }) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status") || "pending";
    const limit = parseInt(url.searchParams.get("limit")) || 20;
    const offset = parseInt(url.searchParams.get("offset")) || 0;
    const { results } = await env.DB.prepare(`
        SELECT 
            r.*,
            reporter.username as reporter_name,
            reported.username as reported_username
        FROM reports r
        LEFT JOIN users reporter ON r.reporter_id = reporter.id
        LEFT JOIN users reported ON r.reported_user_id = reported.id
        WHERE r.status = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
      `).bind(status, limit, offset).all();
    const total = await env.DB.prepare("SELECT COUNT(*) as total FROM reports WHERE status = ?").bind(status).first("total");
    return new Response(JSON.stringify({
      success: true,
      reports: results,
      total,
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(total / limit)
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_reports = __esm({
  "api/moderation/reports.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestGet9, "onRequestGet");
  }
});

// api/moderation/resolve.js
async function onRequestPost20({ request, env }) {
  try {
    const data = await request.json();
    const { report_id, action, notes, moderator_id } = data;
    if (!report_id || !action) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }
    await env.DB.prepare(`
        UPDATE reports 
        SET status = 'resolved', resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(JSON.stringify({ action, notes }), report_id).run();
    if (action === "ban_user") {
      const report = await env.DB.prepare("SELECT reported_user_id FROM reports WHERE id = ?").bind(report_id).first();
      if (report && report.reported_user_id) {
        await env.DB.prepare("UPDATE users SET is_active = 0 WHERE id = ?").bind(report.reported_user_id).run();
      }
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_resolve = __esm({
  "api/moderation/resolve.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost20, "onRequestPost");
  }
});

// api/moderation/resolve_report.js
async function onRequestPost21(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response("Invalid token", { status: 401 });
  const moderatorId = decoded.id;
  const allowed = await hasPermission(env, moderatorId, "resolve_reports");
  if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  try {
    const { report_id, status, notes } = await request.json();
    if (!report_id || !status) return new Response("Missing fields", { status: 400 });
    await env.DB.prepare(`
        UPDATE reports 
        SET status = ?, moderator_id = ?, resolution_notes = ?, resolved_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).bind(status, moderatorId, notes, report_id).run();
    await logAudit(env, {
      userId: moderatorId,
      action: "report_resolved",
      targetEntityType: "report",
      targetEntityId: report_id,
      details: { status, notes },
      ipAddress: "127.0.0.1",
      userAgent: "API"
    });
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_resolve_report = __esm({
  "api/moderation/resolve_report.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    init_audit();
    __name(onRequestPost21, "onRequestPost");
  }
});

// api/moderation/warn.js
async function onRequestPost22(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  const moderatorId = decoded.id;
  const allowed = await hasPermission(env, moderatorId, "issue_warning");
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Forbidden: You do not have permission to issue warnings" }), { status: 403 });
  }
  try {
    const { user_id, reason, severity, expires_in_days } = await request.json();
    if (!user_id || !reason || !severity) {
      return new Response(JSON.stringify({ error: "Missing required fields: user_id, reason, severity" }), { status: 400 });
    }
    const warningId = crypto.randomUUID();
    let expiresAt = null;
    if (expires_in_days) {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() + expires_in_days);
      expiresAt = d.toISOString();
    }
    await env.DB.prepare(`
        INSERT INTO warnings (id, user_id, moderator_id, reason, severity, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(warningId, user_id, moderatorId, reason, severity, expiresAt).run();
    await logAudit(env, {
      userId: moderatorId,
      action: "user_warned",
      targetEntityType: "user",
      targetEntityId: user_id,
      targetUserId: user_id,
      details: { reason, severity, warningId },
      ipAddress: request.headers.get("CF-Connecting-IP") || "127.0.0.1",
      userAgent: request.headers.get("User-Agent")
    });
    return new Response(JSON.stringify({ success: true, message: "Warning issued successfully", warning_id: warningId }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_warn = __esm({
  "api/moderation/warn.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    init_audit();
    __name(onRequestPost22, "onRequestPost");
  }
});

// api/notifications/read-all.js
async function onRequestPost23(context) {
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
var init_read_all = __esm({
  "api/notifications/read-all.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost23, "onRequestPost");
  }
});

// api/reputation/history.js
async function onRequestGet10(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  try {
    const url = new URL(request.url);
    const targetUserId = url.searchParams.get("user_id") || decoded.id;
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
var init_history = __esm({
  "api/reputation/history.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    __name(onRequestGet10, "onRequestGet");
  }
});

// api/reputation/upvote.js
async function onRequestPost24(context) {
  const { request, env } = context;
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
    const post = await env.DB.prepare(`
        SELECT posts.user_id, title FROM posts 
        JOIN topics ON posts.topic_id = topics.id 
        WHERE posts.id = ?
    `).bind(post_id).first();
    if (!post) return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 });
    const targetUserId = post.user_id;
    const eligibility = await canVote(env, userId, targetUserId, post_id);
    if (!eligibility.allowed) {
      return new Response(JSON.stringify({ error: eligibility.error }), { status: 403 });
    }
    await env.DB.prepare(`
        INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)
    `).bind(userId, post_id).run();
    const points = 10 * (eligibility.voteWeight || 1);
    await addReputation(env, targetUserId, points, "post_upvoted", {
      entityType: "post",
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
var init_upvote = __esm({
  "api/reputation/upvote.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_reputation();
    __name(onRequestPost24, "onRequestPost");
  }
});

// api/user/change-email.js
async function onRequestPost25(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  try {
    const { id, current_password, new_email, security_answer } = await request.json();
    if (!id || !current_password || !new_email) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }
    if (!await verifyPassword(current_password, user.password_hash)) {
      return new Response(JSON.stringify({ error: "Incorrect password" }), { status: 401 });
    }
    if (security_answer && user.security_answer_hash) {
      if (!await verifySecurityAnswer(security_answer, user.security_answer_hash)) {
        return new Response(JSON.stringify({ error: "Incorrect security answer" }), { status: 401 });
      }
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400 });
    }
    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(new_email).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "Email already in use" }), { status: 409 });
    }
    await env.DB.prepare("UPDATE users SET email = ?, email_verified = 0 WHERE id = ?").bind(new_email, id).run();
    await logAudit(env, {
      userId: id,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      targetEntityType: "user",
      targetEntityId: id,
      details: { change: "email_change", old_email: user.email, new_email },
      ipAddress
    });
    return new Response(JSON.stringify({ success: true, message: "Email updated. Please verify your new email." }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_change_email = __esm({
  "api/user/change-email.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_crypto();
    init_audit();
    init_rate_limit();
    __name(onRequestPost25, "onRequestPost");
  }
});

// api/user/change-password.js
async function onRequestPost26(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  try {
    const { id, current_password, new_password } = await request.json();
    if (!id || !current_password || !new_password) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }
    const isValid = await verifyPassword(current_password, user.password_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Incorrect current password" }), { status: 401 });
    }
    const validation = validatePasswordStrength(new_password);
    if (!validation.valid) {
      return new Response(JSON.stringify({ error: "New password too weak", details: validation.errors }), { status: 400 });
    }
    const newHash = await hashPassword(new_password);
    await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(newHash, id).run();
    await logAudit(env, {
      userId: id,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      targetEntityType: "user",
      targetEntityId: id,
      details: { change: "password_change" },
      ipAddress
    });
    return new Response(JSON.stringify({ success: true, message: "Password updated successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_change_password = __esm({
  "api/user/change-password.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_crypto();
    init_audit();
    init_rate_limit();
    __name(onRequestPost26, "onRequestPost");
  }
});

// api/user/delete.js
async function onRequestPost27(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  try {
    const { id, password, security_answer, confirmation } = await request.json();
    if (!id || !password || !confirmation) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }
    if (confirmation !== "DELETE MY ACCOUNT") {
      return new Response(JSON.stringify({ error: "Invalid confirmation phrase" }), { status: 400 });
    }
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    if (!await verifyPassword(password, user.password_hash)) {
      return new Response(JSON.stringify({ error: "Incorrect password" }), { status: 401 });
    }
    if (user.security_answer_hash && security_answer) {
      if (!await verifySecurityAnswer(security_answer, user.security_answer_hash)) {
        return new Response(JSON.stringify({ error: "Incorrect security answer" }), { status: 401 });
      }
    } else if (user.security_answer_hash && !security_answer) {
      return new Response(JSON.stringify({ error: "Security answer required" }), { status: 400 });
    }
    await env.DB.prepare(`
        UPDATE users 
        SET is_active = 0, 
            email = 'deleted_' || id || '@deleted.com', 
            username = 'deleted_' || substr(id, 1, 8),
            avatar_url = null,
            bio = 'This user has deleted their account.'
        WHERE id = ?
    `).bind(id).run();
    await logAudit(env, {
      userId: id,
      action: AUDIT_ACTIONS.USER_DELETED,
      targetEntityType: "user",
      targetEntityId: id,
      details: { reason: "user_requested_deletion", original_username: user.username },
      ipAddress
    });
    return new Response(JSON.stringify({ success: true, message: "Account deleted successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_delete2 = __esm({
  "api/user/delete.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_crypto();
    init_audit();
    init_rate_limit();
    __name(onRequestPost27, "onRequestPost");
  }
});

// api/user/get.js
async function onRequestGet11(context) {
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
    let level = "Novice";
    try {
      const levelData = await getUserLevel(env, user.reputation || 0, "en");
      level = levelData?.name || "Novice";
    } catch (e) {
      console.warn("Failed to get level", e);
    }
    let profileData = {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      reputation: user.reputation,
      level,
      // joined: user.created_at, // Use created_at directly if frontend expects it
      created_at: user.created_at,
      role: user.role,
      // Alias role_id
      bio: user.bio,
      car_model: user.car_model,
      city: user.city,
      country: user.country
    };
    if (user.privacy_level !== "public" && requestorId !== user.id) {
    }
    return new Response(JSON.stringify(profileData), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Get Profile Error:", e);
    return new Response(JSON.stringify({ error: "Failed to fetch profile" }), { status: 500 });
  }
}
var init_get = __esm({
  "api/user/get.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_reputation();
    __name(onRequestGet11, "onRequestGet");
  }
});

// api/user/update.js
async function onRequestPost28(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  try {
    const body = await request.clone().json();
    const {
      id,
      current_password,
      // Personal Info
      first_name,
      last_name,
      age,
      city,
      country,
      // BMW Info
      car_model,
      bmw_year,
      bmw_body,
      bmw_engine,
      // Profile
      bio,
      avatar_url,
      privacy_level
      // Read-only/Restricted fields that shouldn't be updated here:
      // username, email, role, reputation, etc.
    } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: "User ID required" }), { status: 400 });
    }
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }
    if (current_password) {
      const isValidPassword = await verifyPassword(current_password, user.password_hash);
      if (!isValidPassword) {
        return new Response(JSON.stringify({ error: "Incorrect password" }), { status: 401 });
      }
    }
    const requestorId = request.headers.get("X-User-ID");
    await env.DB.prepare(`
      UPDATE users SET 
        first_name = ?, last_name = ?, age = ?,
        city = ?, country = ?,
        car_model = ?, bmw_year = ?, bmw_body = ?, bmw_engine = ?,
        bio = ?, avatar_url = ?, privacy_level = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      first_name || null,
      last_name || null,
      age || null,
      city || null,
      country || null,
      car_model || null,
      bmw_year || null,
      bmw_body || null,
      bmw_engine || null,
      bio || null,
      avatar_url || user.avatar_url,
      // Keep existing if not provided
      privacy_level || user.privacy_level || "public",
      id
    ).run();
    await logAudit(env, {
      userId: id,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      targetEntityType: "user",
      targetEntityId: id,
      details: {
        change: "profile_update",
        fields: Object.keys(body).filter((k) => k !== "current_password" && k !== "id")
      },
      ipAddress,
      userAgent: request.headers.get("User-Agent")
    });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("Profile Update Error:", e);
    return new Response(JSON.stringify({ error: "Failed to update profile" }), { status: 500 });
  }
}
var init_update = __esm({
  "api/user/update.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_crypto();
    init_audit();
    init_rate_limit();
    __name(onRequestPost28, "onRequestPost");
  }
});

// api/admin/categories.js
function slugify(text) {
  return text.toString().toLowerCase().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-").replace(/^-+/, "").replace(/-+$/, "");
}
async function onRequest(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }
  const userId = decoded.id;
  const checkPermission = requirePermission("manage_categories");
  const authError = await checkPermission(context, userId);
  if (authError) return authError;
  if (request.method === "GET") {
    return handleGet(context);
  } else if (request.method === "POST") {
    return handlePost(context);
  } else if (request.method === "PUT") {
    return handlePut(context);
  } else if (request.method === "DELETE") {
    return handleDelete(context);
  }
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}
async function handleGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare("SELECT * FROM categories ORDER BY sort_order ASC").all();
    return new Response(JSON.stringify({ success: true, categories: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
async function handlePost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { title, description, icon, sort_order, min_role_read, min_role_write } = data;
    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), { status: 400 });
    }
    const id = crypto.randomUUID();
    const slug = slugify(title);
    await env.DB.prepare(`
            INSERT INTO categories (id, slug, title, description, icon, sort_order, min_role_read, min_role_write)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      id,
      slug,
      title,
      description,
      icon || "fas fa-folder",
      sort_order || 0,
      min_role_read || "user_role",
      min_role_write || "user_role"
    ).run();
    await logAudit2(env, context.userId, "category_created", "category", id, { title });
    return new Response(JSON.stringify({ success: true, category_id: id }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
async function handlePut(context) {
  const { request, env } = context;
  try {
    const data = await request.json();
    const { id, title, description, icon, sort_order, is_active, min_role_read, min_role_write } = data;
    if (!id) return new Response(JSON.stringify({ error: "ID required" }), { status: 400 });
    let query = "UPDATE categories SET ";
    let params = [];
    let updates = [];
    if (title) {
      updates.push("title = ?");
      params.push(title);
      updates.push("slug = ?");
      params.push(slugify(title));
    }
    if (description !== void 0) {
      updates.push("description = ?");
      params.push(description);
    }
    if (icon) {
      updates.push("icon = ?");
      params.push(icon);
    }
    if (sort_order !== void 0) {
      updates.push("sort_order = ?");
      params.push(sort_order);
    }
    if (is_active !== void 0) {
      updates.push("is_active = ?");
      params.push(is_active);
    }
    if (min_role_read) {
      updates.push("min_role_read = ?");
      params.push(min_role_read);
    }
    if (min_role_write) {
      updates.push("min_role_write = ?");
      params.push(min_role_write);
    }
    if (updates.length === 0) return new Response(JSON.stringify({ error: "No fields to update" }), { status: 400 });
    query += updates.join(", ") + " WHERE id = ?";
    params.push(id);
    await env.DB.prepare(query).bind(...params).run();
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
async function handleDelete(context) {
  const { request, env } = context;
  try {
    const { id } = await request.json();
    if (!id) return new Response(JSON.stringify({ error: "ID required" }), { status: 400 });
    const topicCount = await env.DB.prepare("SELECT COUNT(*) as count FROM topics WHERE category = (SELECT slug FROM categories WHERE id = ?)").bind(id).first("count");
    if (topicCount > 0) {
      return new Response(JSON.stringify({ error: "Cannot delete category with existing topics" }), { status: 400 });
    }
    await env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
async function logAudit2(env, userId, action, type, targetId, details) {
  try {
    await env.DB.prepare(
      "INSERT INTO audit_logs (id, user_id, action, target_entity_type, target_entity_id, details) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), userId || "system", action, type, targetId, JSON.stringify(details)).run();
  } catch (e) {
    console.error("Audit Log Error:", e);
  }
}
var init_categories = __esm({
  "api/admin/categories.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    __name(slugify, "slugify");
    __name(onRequest, "onRequest");
    __name(handleGet, "handleGet");
    __name(handlePost, "handlePost");
    __name(handlePut, "handlePut");
    __name(handleDelete, "handleDelete");
    __name(logAudit2, "logAudit");
  }
});

// api/admin/messages.js
async function onRequest2(context) {
  const { request, env } = context;
  const db = env.DB;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401 });
  if (request.method === "GET") {
    try {
      const { results } = await db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 50").all();
      return new Response(JSON.stringify({ success: true, messages: results }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      if (e.message.includes("no such table")) {
        return new Response(JSON.stringify({ success: true, messages: [] }), { headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
  if (request.method === "PUT") {
    try {
      const { id, action } = await request.json();
      if (action === "mark_read") {
        await db.prepare("UPDATE contact_messages SET is_read = 1 WHERE id = ?").bind(id).run();
      } else if (action === "delete") {
        await db.prepare("DELETE FROM contact_messages WHERE id = ?").bind(id).run();
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }
  return new Response("Method not allowed", { status: 405 });
}
var init_messages = __esm({
  "api/admin/messages.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequest2, "onRequest");
  }
});

// api/admin/tags.js
async function onRequest3(context) {
  const { request, env } = context;
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  const userId = decoded.id;
  const checkPermission = requirePermission("manage_categories");
  const authError = await checkPermission(context, userId);
  if (authError) return authError;
  if (request.method === "GET") return handleGet2(context);
  if (request.method === "POST") return handlePost2(context);
  if (request.method === "DELETE") return handleDelete2(context);
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}
async function handleGet2(context) {
  try {
    const { results } = await context.env.DB.prepare("SELECT * FROM tags ORDER BY name ASC").all();
    return new Response(JSON.stringify({ success: true, tags: results }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
async function handlePost2(context) {
  try {
    const { name, color } = await context.request.json();
    if (!name) return new Response(JSON.stringify({ error: "Name required" }), { status: 400 });
    const id = crypto.randomUUID();
    await context.env.DB.prepare("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)").bind(id, name, color || "#3498db").run();
    return new Response(JSON.stringify({ success: true, tag: { id, name, color } }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
async function handleDelete2(context) {
  try {
    const { id } = await context.request.json();
    if (!id) return new Response(JSON.stringify({ error: "ID required" }), { status: 400 });
    await context.env.DB.prepare("DELETE FROM tags WHERE id = ?").bind(id).run();
    await context.env.DB.prepare("DELETE FROM topic_tags WHERE tag_id = ?").bind(id).run();
    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_tags = __esm({
  "api/admin/tags.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    init_jwt();
    init_permissions();
    __name(onRequest3, "onRequest");
    __name(handleGet2, "handleGet");
    __name(handlePost2, "handlePost");
    __name(handleDelete2, "handleDelete");
  }
});

// api/forum/topic.js
async function onRequest4(context) {
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
          SELECT t.*, u.avatar_url as author_avatar, u.role_id as author_role 
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
    u.role_id as author_role,          -- \u0414\u043E\u0441\u0442\u0430\u0435\u043C \u0440\u043E\u043B\u044C \u0430\u0432\u0442\u043E\u0440\u0430
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
var init_topic = __esm({
  "api/forum/topic.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequest4, "onRequest");
  }
});

// api/forum/topics.js
async function onRequest5(context) {
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
var init_topics = __esm({
  "api/forum/topics.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequest5, "onRequest");
  }
});

// api/notifications/[id].js
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
var init_id2 = __esm({
  "api/notifications/[id].js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestDelete, "onRequestDelete");
  }
});

// api/categories.js
async function onRequestGet12(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC"
    ).all();
    return new Response(JSON.stringify({ success: true, categories: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_categories2 = __esm({
  "api/categories.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestGet12, "onRequestGet");
  }
});

// api/config.js
async function onRequestGet13({ env }) {
  try {
    const { results } = await env.DB.prepare("SELECT key, value FROM system_settings WHERE key IN ('site_name', 'maintenance_mode', 'registrations_open', 'announcement_banner', 'announcement_active')").all();
    const config = {};
    results.forEach((row) => {
      config[row.key] = row.value;
    });
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
var init_config = __esm({
  "api/config.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestGet13, "onRequestGet");
  }
});

// api/contact.js
async function onRequestPost29(context) {
  const { request, env } = context;
  const db = env.DB;
  try {
    const { name, email, subject, message } = await request.json();
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }
    const id = crypto.randomUUID();
    const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
    await db.prepare(
      "INSERT INTO contact_messages (id, name, email, subject, message, ip_address) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, name, email, subject || "No Subject", message, ip).run();
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
var init_contact = __esm({
  "api/contact.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestPost29, "onRequestPost");
  }
});

// api/notifications/index.js
async function onRequestGet14(context) {
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
            SELECT *, topic_title as text FROM notifications 
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
var init_notifications = __esm({
  "api/notifications/index.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestGet14, "onRequestGet");
  }
});

// api/upload.js
async function onRequest6(context) {
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
var init_upload = __esm({
  "api/upload.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequest6, "onRequest");
  }
});

// images/[filename].js
async function onRequestGet15(context) {
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
var init_filename = __esm({
  "images/[filename].js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequestGet15, "onRequestGet");
  }
});

// _middleware.js
async function onRequest7(context) {
  const { request, next, env } = context;
  const response = await next();
  const newHeaders = new Headers(response.headers);
  newHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  newHeaders.set("X-Content-Type-Options", "nosniff");
  newHeaders.set("X-XSS-Protection", "1; mode=block");
  newHeaders.set("X-Frame-Options", "DENY");
  newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
var init_middleware = __esm({
  "_middleware.js"() {
    init_functionsRoutes_0_2333257447238799();
    init_checked_fetch();
    __name(onRequest7, "onRequest");
  }
});

// ../.wrangler/tmp/pages-q7i9xM/functionsRoutes-0.2333257447238799.mjs
var routes;
var init_functionsRoutes_0_2333257447238799 = __esm({
  "../.wrangler/tmp/pages-q7i9xM/functionsRoutes-0.2333257447238799.mjs"() {
    init_send();
    init_assign();
    init_init();
    init_reset();
    init_verify();
    init_id();
    init_read();
    init_analytics();
    init_ban();
    init_logs();
    init_promote();
    init_settings();
    init_settings();
    init_stats();
    init_unban();
    init_users();
    init_track();
    init_get_recovery_question();
    init_login();
    init_recover();
    init_register();
    init_delete();
    init_edit();
    init_like();
    init_solve();
    init_list_reports();
    init_report();
    init_reports();
    init_resolve();
    init_resolve_report();
    init_warn();
    init_read_all();
    init_history();
    init_upvote();
    init_change_email();
    init_change_password();
    init_delete2();
    init_get();
    init_update();
    init_categories();
    init_messages();
    init_tags();
    init_topic();
    init_topics();
    init_id2();
    init_categories2();
    init_config();
    init_contact();
    init_notifications();
    init_upload();
    init_filename();
    init_middleware();
    routes = [
      {
        routePath: "/api/admin/announcements/send",
        mountPath: "/api/admin/announcements",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost]
      },
      {
        routePath: "/api/admin/roles/assign",
        mountPath: "/api/admin/roles",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost2]
      },
      {
        routePath: "/api/auth/password-recovery/init",
        mountPath: "/api/auth/password-recovery",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost3]
      },
      {
        routePath: "/api/auth/password-recovery/reset",
        mountPath: "/api/auth/password-recovery",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost4]
      },
      {
        routePath: "/api/auth/password-recovery/verify",
        mountPath: "/api/auth/password-recovery",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost5]
      },
      {
        routePath: "/api/admin/users/:id",
        mountPath: "/api/admin/users",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet]
      },
      {
        routePath: "/api/notifications/:id/read",
        mountPath: "/api/notifications/:id",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost6]
      },
      {
        routePath: "/api/admin/analytics",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet2]
      },
      {
        routePath: "/api/admin/ban",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost7]
      },
      {
        routePath: "/api/admin/logs",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet3]
      },
      {
        routePath: "/api/admin/promote",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet4]
      },
      {
        routePath: "/api/admin/settings",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet5]
      },
      {
        routePath: "/api/admin/settings",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost8]
      },
      {
        routePath: "/api/admin/stats",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet6]
      },
      {
        routePath: "/api/admin/unban",
        mountPath: "/api/admin",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost9]
      },
      {
        routePath: "/api/admin/users",
        mountPath: "/api/admin",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet7]
      },
      {
        routePath: "/api/analytics/track",
        mountPath: "/api/analytics",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost10]
      },
      {
        routePath: "/api/auth/get_recovery_question",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost11]
      },
      {
        routePath: "/api/auth/login",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost12]
      },
      {
        routePath: "/api/auth/recover",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost13]
      },
      {
        routePath: "/api/auth/register",
        mountPath: "/api/auth",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost14]
      },
      {
        routePath: "/api/forum/delete",
        mountPath: "/api/forum",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost15]
      },
      {
        routePath: "/api/forum/edit",
        mountPath: "/api/forum",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost16]
      },
      {
        routePath: "/api/forum/like",
        mountPath: "/api/forum",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost17]
      },
      {
        routePath: "/api/forum/solve",
        mountPath: "/api/forum",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost18]
      },
      {
        routePath: "/api/moderation/list_reports",
        mountPath: "/api/moderation",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet8]
      },
      {
        routePath: "/api/moderation/report",
        mountPath: "/api/moderation",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost19]
      },
      {
        routePath: "/api/moderation/reports",
        mountPath: "/api/moderation",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet9]
      },
      {
        routePath: "/api/moderation/resolve",
        mountPath: "/api/moderation",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost20]
      },
      {
        routePath: "/api/moderation/resolve_report",
        mountPath: "/api/moderation",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost21]
      },
      {
        routePath: "/api/moderation/warn",
        mountPath: "/api/moderation",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost22]
      },
      {
        routePath: "/api/notifications/read-all",
        mountPath: "/api/notifications",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost23]
      },
      {
        routePath: "/api/reputation/history",
        mountPath: "/api/reputation",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet10]
      },
      {
        routePath: "/api/reputation/upvote",
        mountPath: "/api/reputation",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost24]
      },
      {
        routePath: "/api/user/change-email",
        mountPath: "/api/user",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost25]
      },
      {
        routePath: "/api/user/change-password",
        mountPath: "/api/user",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost26]
      },
      {
        routePath: "/api/user/delete",
        mountPath: "/api/user",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost27]
      },
      {
        routePath: "/api/user/get",
        mountPath: "/api/user",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet11]
      },
      {
        routePath: "/api/user/update",
        mountPath: "/api/user",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost28]
      },
      {
        routePath: "/api/admin/categories",
        mountPath: "/api/admin",
        method: "",
        middlewares: [],
        modules: [onRequest]
      },
      {
        routePath: "/api/admin/messages",
        mountPath: "/api/admin",
        method: "",
        middlewares: [],
        modules: [onRequest2]
      },
      {
        routePath: "/api/admin/tags",
        mountPath: "/api/admin",
        method: "",
        middlewares: [],
        modules: [onRequest3]
      },
      {
        routePath: "/api/forum/topic",
        mountPath: "/api/forum",
        method: "",
        middlewares: [],
        modules: [onRequest4]
      },
      {
        routePath: "/api/forum/topics",
        mountPath: "/api/forum",
        method: "",
        middlewares: [],
        modules: [onRequest5]
      },
      {
        routePath: "/api/notifications/:id",
        mountPath: "/api/notifications",
        method: "DELETE",
        middlewares: [],
        modules: [onRequestDelete]
      },
      {
        routePath: "/api/categories",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet12]
      },
      {
        routePath: "/api/config",
        mountPath: "/api",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet13]
      },
      {
        routePath: "/api/contact",
        mountPath: "/api",
        method: "POST",
        middlewares: [],
        modules: [onRequestPost29]
      },
      {
        routePath: "/api/notifications",
        mountPath: "/api/notifications",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet14]
      },
      {
        routePath: "/api/upload",
        mountPath: "/api",
        method: "",
        middlewares: [],
        modules: [onRequest6]
      },
      {
        routePath: "/images/:filename",
        mountPath: "/images",
        method: "GET",
        middlewares: [],
        modules: [onRequestGet15]
      },
      {
        routePath: "/",
        mountPath: "/",
        method: "",
        middlewares: [onRequest7],
        modules: []
      }
    ];
  }
});

// ../.wrangler/tmp/bundle-AJMH4U/middleware-loader.entry.ts
init_functionsRoutes_0_2333257447238799();
init_checked_fetch();

// ../.wrangler/tmp/bundle-AJMH4U/middleware-insertion-facade.js
init_functionsRoutes_0_2333257447238799();
init_checked_fetch();

// ../node_modules/wrangler/templates/pages-template-worker.ts
init_functionsRoutes_0_2333257447238799();
init_checked_fetch();

// ../node_modules/path-to-regexp/dist.es2015/index.js
init_functionsRoutes_0_2333257447238799();
init_checked_fetch();
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
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
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
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
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
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
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
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
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
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
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
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
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
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
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
          passThroughOnException: /* @__PURE__ */ __name(() => {
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
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_functionsRoutes_0_2333257447238799();
init_checked_fetch();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
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

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_functionsRoutes_0_2333257447238799();
init_checked_fetch();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
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

// ../.wrangler/tmp/bundle-AJMH4U/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
init_functionsRoutes_0_2333257447238799();
init_checked_fetch();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
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
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-AJMH4U/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
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
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
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
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.22824723860417162.mjs.map
