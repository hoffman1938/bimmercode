// functions/api/user/delete.js - Delete Account API (Soft Delete)

import { verifyPassword, verifySecurityAnswer } from "../../lib/crypto.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";
import { getIpAddress } from "../../lib/rate-limit.js";

export async function onRequestPost(context) {
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

    // 1. Verify User
    const user = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!user) return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });

    // 2. Verify Password
    if (!(await verifyPassword(password, user.password_hash))) {
        return new Response(JSON.stringify({ error: "Incorrect password" }), { status: 401 });
    }

    // 3. Verify Security Answer
    if (user.security_answer_hash && security_answer) {
        if (!(await verifySecurityAnswer(security_answer, user.security_answer_hash))) {
            return new Response(JSON.stringify({ error: "Incorrect security answer" }), { status: 401 });
        }
    } else if (user.security_answer_hash && !security_answer) {
         return new Response(JSON.stringify({ error: "Security answer required" }), { status: 400 });
    }

    // 4. Soft Delete (Deactivate)
    // We anonymize the email so they can't recover easily, or just set is_active=0
    // To allow re-registration with same email, we should transform the email.
    // But for now, let's just set is_active = 0.
    
    await env.DB.prepare(`
        UPDATE users 
        SET is_active = 0, 
            email = 'deleted_' || id || '@deleted.com', 
            username = 'deleted_' || substr(id, 1, 8),
            avatar_url = null,
            bio = 'This user has deleted their account.'
        WHERE id = ?
    `).bind(id).run();

    // 5. Audit Log
    await logAudit(env, {
      userId: id,
      action: AUDIT_ACTIONS.USER_DELETED,
      targetEntityType: 'user',
      targetEntityId: id,
      details: { reason: 'user_requested_deletion', original_username: user.username },
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
