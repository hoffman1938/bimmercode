export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    const body = await request.json();
    const { name, email, subject, message, type } = body;

    // Basic Validation
    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // ─── Gmail via EmailJS REST API ───────────────────────────────────────────
    if (type === 'gmail') {
      const serviceId   = env.EMAILJS_SERVICE_ID;
      const templateId  = env.EMAILJS_TEMPLATE_ID;
      const publicKey   = env.EMAILJS_PUBLIC_KEY;
      const privateKey  = env.EMAILJS_PRIVATE_KEY;
      const recipient   = env.RECIPIENT_EMAIL || 'codesbimmer@gmail.com';

      if (!serviceId || !templateId || !publicKey) {
        return new Response(JSON.stringify({ error: "EmailJS not configured on server" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      const ejsRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id:   serviceId,
          template_id:  templateId,
          user_id:      publicKey,
          ...(privateKey ? { accessToken: privateKey } : {}),
          template_params: {
            from_name:  name,
            from_email: email,
            subject:    subject || 'No Subject',
            message:    message,
            to_email:   recipient,
          }
        })
      });

      if (ejsRes.ok) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" }
        });
      } else {
        const errText = await ejsRes.text();
        return new Response(JSON.stringify({ error: "EmailJS error: " + errText }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // ─── Admin DB Inbox ───────────────────────────────────────────────────────
    const id = crypto.randomUUID();
    const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";

    await db.prepare(
      "INSERT INTO contact_messages (id, name, email, subject, message, ip_address) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, name, email, subject || "No Subject", message, ip).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
