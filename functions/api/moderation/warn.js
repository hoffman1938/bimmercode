// functions/api/moderation/warn.js - Issue Warning API
import { verifyToken } from "../../lib/jwt.js";
import { hasPermission } from "../../lib/permissions.js";
import { logAudit, AUDIT_ACTIONS } from "../../lib/audit.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Authenticate
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
  if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  
  const moderatorId = decoded.id;

  // 2. Check Permission
  const allowed = await hasPermission(env, moderatorId, "issue_warning");
  if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden: You do not have permission to issue warnings" }), { status: 403 });
  }

  try {
    const { user_id, reason, severity, expires_in_days } = await request.json();

    if (!user_id || !reason || !severity) {
        return new Response(JSON.stringify({ error: "Missing required fields: user_id, reason, severity" }), { status: 400 });
    }

    // 3. Issue Warning
    const warningId = crypto.randomUUID();
    let expiresAt = null;
    if (expires_in_days) {
        const d = new Date();
        d.setDate(d.getDate() + expires_in_days);
        expiresAt = d.toISOString();
    }

    await env.DB.prepare(`
        INSERT INTO warnings (id, user_id, moderator_id, reason, severity, expires_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(warningId, user_id, moderatorId, reason, severity, expiresAt).run();

    // 4. Log Audit
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
