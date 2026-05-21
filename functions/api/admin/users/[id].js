import { authenticateAdminRequest } from "../../../lib/admin-gate.js";
import { getUserRole } from "../../../lib/permissions.js";
import { logAudit, AUDIT_ACTIONS } from "../../../lib/audit.js";
import { getIpAddress } from "../../../lib/rate-limit.js";
import {
  validateUsername,
  validateEmail,
  ensureUsernameAvailable,
  ensureEmailAvailable,
  profileFieldsFromBody,
  applyUserColumnUpdates,
  applyNewPassword,
  propagateUsername,
  jsonResponse,
} from "../../../lib/user-account.js";
import { validateRoleChange } from "../../../lib/role-assign.js";

function emailInList(env, email, varName) {
  const raw = env[varName];
  if (!email || !raw) return false;
  const e = String(email).trim().toLowerCase();
  return String(raw)
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(e);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;

  try {
      const url = new URL(request.url);
      const parts = url.pathname.split('/');
      const userId = parts[parts.length - 1]; // /api/admin/users/:id

      if (!userId) {
          return new Response(JSON.stringify({ error: "User ID required" }), { status: 400 });
      }

      // 1. Basic User Info
      const user = await env.DB.prepare(`
        SELECT id, username, email, role_id, created_at, last_login, is_active, reputation,
               failed_login_attempts, first_name, last_name, age, city, country,
               car_model, bmw_year, bmw_body, bmw_engine, bio, avatar_url,
               privacy_level, preferred_lang, email_verified
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

      let bans = [];
      try {
        const r = await env.DB.prepare(
          `SELECT reason, banned_at, expires_at, lifted_at, issued_by
           FROM user_bans WHERE user_id = ? ORDER BY banned_at DESC LIMIT 20`
        ).bind(userId).all();
        bans = r.results || [];
      } catch (_) {}

      return new Response(JSON.stringify({
          success: true,
          user: user,
          history: {
              logins,
              warnings,
              reputation,
              bans
          }
      }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

/** PATCH /api/admin/users/:id — full account edit (admin) */
export async function onRequestPatch(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;

  const { request, env } = context;
  const ipAddress = getIpAddress(request);
  const url = new URL(request.url);
  const targetId = url.pathname.split("/").pop();

  if (!targetId) return jsonResponse({ error: "User ID required" }, 400);

  try {
    const body = await request.json();
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(targetId).first();
    if (!user) return jsonResponse({ error: "User not found" }, 404);

    const columnMap = profileFieldsFromBody(body, { admin: true });
    const changed = [];

    if (body.username !== undefined) {
      const v = validateUsername(body.username);
      if (!v.ok) return jsonResponse({ error: v.error }, 400);
      if (v.value !== user.username) {
        const free = await ensureUsernameAvailable(env.DB, v.value, targetId);
        if (!free.ok) return jsonResponse({ error: free.error }, 409);
        columnMap.username = v.value;
        changed.push("username");
      }
    }

    if (body.email !== undefined) {
      const v = validateEmail(body.email);
      if (!v.ok) return jsonResponse({ error: v.error }, 400);
      if (v.value !== user.email) {
        const free = await ensureEmailAvailable(env.DB, v.value, targetId);
        if (!free.ok) return jsonResponse({ error: free.error }, 409);
        columnMap.email = v.value;
        changed.push("email");
      }
    }

    if (body.role_id !== undefined && body.role_id !== user.role_id) {
      const adminRole = await getUserRole(env, auth.userId);
      const targetRole = await env.DB.prepare("SELECT id FROM roles WHERE id = ?")
        .bind(body.role_id)
        .first();
      if (!targetRole) return jsonResponse({ error: "Invalid role ID" }, 400);

      const superPromo =
        body.role_id === "super_admin_role" &&
        user.email &&
        emailInList(env, user.email, "SUPER_ADMIN_PROMOTE_EMAILS");

      const check = validateRoleChange({
        actorRoleId: adminRole?.id,
        targetCurrentRoleId: user.role_id,
        newRoleId: body.role_id,
        superPromoAllowed: superPromo,
      });
      if (!check.ok) return jsonResponse({ error: check.error }, 403);

      columnMap.role_id = body.role_id;
      changed.push("role_id");
    }

    if (body.new_password) {
      const pw = await applyNewPassword(env.DB, targetId, body.new_password);
      if (!pw.ok) return jsonResponse({ error: pw.error, details: pw.details }, 400);
      changed.push("password");
    }

    const restrictionFields = [
      "is_muted",
      "shadow_banned",
      "restrict_uploads",
      "restrict_links",
      "restrict_new_topics",
      "vin_verified",
      "vin",
      "badges_json",
    ];
    for (const key of restrictionFields) {
      if (body[key] !== undefined) {
        columnMap[key] =
          key === "vin" || key === "badges_json"
            ? body[key]
            : body[key] ? 1 : 0;
        changed.push(key);
      }
    }

    Object.keys(columnMap).forEach((k) => {
      if (!changed.includes(k)) changed.push(k);
    });

    if (Object.keys(columnMap).length) {
      await applyUserColumnUpdates(env.DB, targetId, columnMap);
      if (columnMap.username) {
        await propagateUsername(env.DB, targetId, columnMap.username);
      }
    }

    if (!changed.length) {
      return jsonResponse({ success: true, noop: true });
    }

    await logAudit(env, {
      userId: auth.userId,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      targetEntityType: "user",
      targetEntityId: targetId,
      targetUserId: targetId,
      details: { change: "admin_user_edit", fields: changed },
      ipAddress,
      userAgent: request.headers.get("User-Agent"),
    });

    const updated = await env.DB.prepare(
      "SELECT id, username, email, role_id, is_active, reputation FROM users WHERE id = ?"
    )
      .bind(targetId)
      .first();

    return jsonResponse({ success: true, user: updated });
  } catch (e) {
    console.error("admin user patch:", e);
    return jsonResponse({ error: e.message || "Update failed" }, 500);
  }
}
