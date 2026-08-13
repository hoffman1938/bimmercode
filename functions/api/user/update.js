// POST /api/user/update — profile + username (authenticated user only)

import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";
import { getIpAddress } from "../../lib/rate-limit.js";
import {
  getBearerUser,
  validateUsername,
  ensureUsernameAvailable,
  profileFieldsFromBody,
  applyUserColumnUpdates,
  propagateUsername,
  jsonResponse,
} from "../../lib/user-account.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);

  try {
    const body = await request.json();
    const userId = body.id;
    if (!userId) return jsonResponse({ error: "User ID required" }, 400);

    const tokenUser = await getBearerUser(request, env);
    if (!tokenUser?.id || String(tokenUser.id) !== String(userId)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const user = await env.DB.prepare("SELECT id, username FROM users WHERE id = ?").bind(userId).first();
    if (!user) return jsonResponse({ error: "User not found" }, 404);

    const columnMap = profileFieldsFromBody(body, { admin: false });
    const changed = [];

    if (body.username !== undefined) {
      const v = validateUsername(body.username);
      if (!v.ok) return jsonResponse({ error: v.error }, 400);
      if (v.value !== user.username) {
        const free = await ensureUsernameAvailable(env.DB, v.value, userId);
        if (!free.ok) return jsonResponse({ error: free.error }, 409);
        columnMap.username = v.value;
        changed.push("username");
      }
    }

    const profileKeys = Object.keys(columnMap).filter((k) => k !== "username");
    if (profileKeys.length) changed.push(...profileKeys);

    if (!Object.keys(columnMap).length) {
      return jsonResponse({ success: true, noop: true });
    }

    await applyUserColumnUpdates(env.DB, userId, columnMap);

    if (columnMap.username) {
      await propagateUsername(env.DB, userId, columnMap.username);
    }

    await logAudit(env, {
      userId,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      targetEntityType: "user",
      targetEntityId: userId,
      details: { change: "profile_update", fields: changed },
      ipAddress,
      userAgent: request.headers.get("User-Agent"),
    });

    return jsonResponse({ success: true, username: columnMap.username || user.username });
  } catch (e) {
    console.error("Profile Update Error:", e);
    return jsonResponse({ error: "Failed to update profile" }, 500);
  }
}
