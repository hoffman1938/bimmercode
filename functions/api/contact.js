
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const { name, email, subject, message } = await request.json();

    // Basic Validation
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    // Generate ID
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
