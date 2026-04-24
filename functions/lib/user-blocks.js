// Block list: who the viewer has blocked (hide their topics + posts in threads, for that viewer only).

import { verifyToken } from "./jwt.js";

/**
 * @param {Request} request
 * @param {{ JWT_SECRET?: string }} env
 * @returns {Promise<string | null>} viewer user id or null
 */
export async function getViewerIdFromRequest(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const secret = env.JWT_SECRET || "secret-dev-key";
  const payload = await verifyToken(auth.slice(7), secret);
  return payload?.id ? String(payload.id) : null;
}

/**
 * @param {D1Database} db
 * @param {string} blockerId
 * @returns {Promise<string[]>}
 */
export async function getBlockedUserIdsForBlocker(db, blockerId) {
  if (!db || !blockerId) return [];
  try {
    const { results } = await db
      .prepare("SELECT blocked_id FROM user_blocks WHERE blocker_id = ?")
      .bind(String(blockerId))
      .all();
    return (results || []).map((r) => String(r.blocked_id));
  } catch {
    return [];
  }
}

/**
 * @param {D1Database} db
 * @param {string} blockerId
 * @param {string} blockedId
 * @returns {Promise<boolean>}
 */
export async function isUserBlockedBy(db, blockerId, blockedId) {
  if (!db || !blockerId || !blockedId) return false;
  if (String(blockerId) === String(blockedId)) return false;
  try {
    const row = await db
      .prepare("SELECT 1 AS x FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?")
      .bind(String(blockerId), String(blockedId))
      .first();
    return !!row;
  } catch {
    return false;
  }
}
