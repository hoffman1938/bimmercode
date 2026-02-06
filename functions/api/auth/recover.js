import { verifyPassword, hashPassword } from "../../lib/crypto.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email, answer, newPassword } = await request.json();

    if (!email || !answer || !newPassword) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
    }

    // 1. Fetch user
    const user = await env.DB.prepare(
      "SELECT id, security_answer_hash FROM users WHERE email = ?"
    ).bind(email).first();

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    if (!user.security_answer_hash) {
        return new Response(JSON.stringify({ error: "Recovery not configured for this account" }), { status: 403 });
    }

    // 2. Verify Answer
    const normalizedAnswer = answer.trim().toLowerCase();
    const isValid = await verifyPassword(normalizedAnswer, user.security_answer_hash);

    if (!isValid) {
      return new Response(JSON.stringify({ error: "Incorrect answer" }), { status: 401 });
    }

    // 3. Update Password
    const newHash = await hashPassword(newPassword);
    
    await env.DB.prepare(
        "UPDATE users SET password_hash = ? WHERE id = ?"
    ).bind(newHash, user.id).run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
