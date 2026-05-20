// Shared user account validation and updates (self-service + admin).

import { hashPassword, validatePasswordStrength } from "./crypto.js";
import { verifyToken } from "./jwt.js";

export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function validateUsername(username) {
  const value = String(username || "").trim();
  if (!USERNAME_REGEX.test(value)) {
    return {
      ok: false,
      error: "Username must be 3-20 characters (letters, numbers, underscore only)",
    };
  }
  return { ok: true, value };
}

export function validateEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { ok: false, error: "Invalid email format" };
  }
  return { ok: true, value };
}

export async function getBearerUser(request, env) {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyToken(auth.slice(7), env.JWT_SECRET || "secret-dev-key");
}

export async function ensureUsernameAvailable(db, username, exceptUserId) {
  const existing = await db
    .prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?")
    .bind(username, exceptUserId || "")
    .first();
  if (existing) return { ok: false, error: "Username already in use" };
  return { ok: true };
}

export async function ensureEmailAvailable(db, email, exceptUserId) {
  const existing = await db
    .prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?")
    .bind(email, exceptUserId || "")
    .first();
  if (existing) return { ok: false, error: "Email already in use" };
  return { ok: true };
}

/** Keep cached author names on forum content in sync. */
export async function propagateUsername(db, userId, newUsername) {
  await db.prepare("UPDATE topics SET username = ? WHERE user_id = ?").bind(newUsername, userId).run();
  await db.prepare("UPDATE posts SET username = ? WHERE user_id = ?").bind(newUsername, userId).run();
}

function optStr(v, max) {
  if (v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? null : s.slice(0, max);
}

function optInt(v, min, max) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return undefined;
  if (min != null && n < min) return min;
  if (max != null && n > max) return max;
  return n;
}

/**
 * Build { column: value } map from request body (only defined keys).
 * @param {object} body
 * @param {{ admin?: boolean }} opts
 */
export function profileFieldsFromBody(body, opts = {}) {
  const out = {};
  const set = (col, val) => {
    if (val !== undefined) out[col] = val;
  };

  set("first_name", optStr(body.first_name, 80));
  set("last_name", optStr(body.last_name, 80));
  set("age", optInt(body.age, 13, 120));
  set("city", optStr(body.city, 60));
  set("country", optStr(body.country, 80));
  set("car_model", optStr(body.car_model, 60));
  set("bmw_year", optInt(body.bmw_year, 1970, 2030));
  set("bmw_body", optStr(body.bmw_body, 40));
  set("bmw_engine", optStr(body.bmw_engine, 40));
  set("bio", body.bio !== undefined ? String(body.bio || "").trim().slice(0, 300) : undefined);
  if (body.avatar_url !== undefined) set("avatar_url", body.avatar_url || null);
  if (body.privacy_level !== undefined) {
    const pl = String(body.privacy_level || "public").trim();
    set("privacy_level", ["public", "private", "friends"].includes(pl) ? pl : "public");
  }
  set("preferred_lang", body.preferred_lang !== undefined ? String(body.preferred_lang || "en").slice(0, 8) : undefined);

  if (opts.admin) {
    if (body.role_id !== undefined) set("role_id", String(body.role_id || "user_role").trim());
    if (body.is_active !== undefined) set("is_active", body.is_active ? 1 : 0);
    if (body.reputation !== undefined) {
      const r = parseInt(body.reputation, 10);
      if (!Number.isNaN(r)) set("reputation", Math.max(0, r));
    }
    if (body.email_verified !== undefined) set("email_verified", body.email_verified ? 1 : 0);
  }

  return out;
}

export async function applyUserColumnUpdates(db, userId, columnMap) {
  const cols = Object.keys(columnMap);
  if (!cols.length) return false;
  const sets = cols.map((c) => `${c} = ?`);
  const vals = cols.map((c) => columnMap[c]);
  await db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, userId).run();
  return true;
}

export async function applyNewPassword(db, userId, newPassword, { requireStrength = true } = {}) {
  if (requireStrength) {
    const v = validatePasswordStrength(newPassword);
    if (!v.valid) return { ok: false, error: "Password does not meet requirements", details: v.errors };
  }
  const hash = await hashPassword(newPassword);
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(hash, userId).run();
  return { ok: true };
}
