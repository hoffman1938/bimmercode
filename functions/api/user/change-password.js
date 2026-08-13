// functions/api/user/change-password.js - Change Password API

import { verifyPassword } from "../../lib/crypto.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";
import { getIpAddress } from "../../lib/rate-limit.js";
import { getBearerUser, applyNewPassword, jsonResponse } from "../../lib/user-account.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);

  try {
    const { id, current_password, new_password } = await request.json();

    if (!id || !current_password || !new_password) {
      return jsonResponse({ error: "Missing fields" }, 400);
    }

    const tokenUser = await getBearerUser(request, env);
    if (!tokenUser?.id || String(tokenUser.id) !== String(id)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // 1. Verify User & Current Password
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    const isValid = await verifyPassword(current_password, user.password_hash);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Incorrect current password" }), { status: 401 });
    }

    const pw = await applyNewPassword(env.DB, id, new_password);
    if (!pw.ok) return jsonResponse({ error: pw.error, details: pw.details }, 400);

    // 4. Log Action
    await logAudit(env, {
      userId: id,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      targetEntityType: 'user',
      targetEntityId: id,
      details: { change: 'password_change' },
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
