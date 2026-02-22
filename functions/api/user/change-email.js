// functions/api/user/change-email.js - Change Email API

import { verifyPassword, hashPassword, verifySecurityAnswer } from "../../lib/crypto.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";
import { getIpAddress } from "../../lib/rate-limit.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const ipAddress = getIpAddress(request);

  try {
    const { id, current_password, new_email, security_answer } = await request.json();

    if (!id || !current_password || !new_email) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    // 1. Verify User & Current Password
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    // High security action: Check Password AND Security Answer (if provided/enforced)
    // For now, let's enforce password. Security answer optional but recommended for high security.
    
    if (!(await verifyPassword(current_password, user.password_hash))) {
      return new Response(JSON.stringify({ error: "Incorrect password" }), { status: 401 });
    }
    
    // Optional: Check Security Answer if this is considered a critical action
    if (security_answer && user.security_answer_hash) {
      if (!(await verifySecurityAnswer(security_answer, user.security_answer_hash))) {
         return new Response(JSON.stringify({ error: "Incorrect security answer" }), { status: 401 });
      }
    }

    // 2. Validate New Email Format & Uniqueness
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(new_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), { status: 400 });
    }

    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(new_email).first();
    if (existing) {
      return new Response(JSON.stringify({ error: "Email already in use" }), { status: 409 });
    }

    // 3. Update Email
    await env.DB.prepare("UPDATE users SET email = ?, email_verified = 0 WHERE id = ?")
      .bind(new_email, id)
      .run();

    // 4. Log Action
    await logAudit(env, {
      userId: id,
      action: AUDIT_ACTIONS.SETTINGS_CHANGED,
      targetEntityType: 'user',
      targetEntityId: id,
      details: { change: 'email_change', old_email: user.email, new_email },
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
