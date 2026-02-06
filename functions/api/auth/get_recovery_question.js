export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), { status: 400 });
    }

    const user = await env.DB.prepare(
      "SELECT security_question FROM users WHERE email = ?"
    ).bind(email).first();

    if (!user) {
        // Return 404 but generic message if preferred. 
        // For UX, knowing email is invalid is helpful here since it's recovery.
        return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }
    
    if (!user.security_question) {
         return new Response(JSON.stringify({ error: "No security question set for this account" }), { status: 400 });
    }

    return new Response(JSON.stringify({ question: user.security_question }), { status: 200 });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
