export async function onRequest(context) {
  const { request, next, env } = context;
  
  // 1. Execute the request
  const response = await next();
  
  // 2. Add Security Headers
  const newHeaders = new Headers(response.headers);
  
  // HSTS - Force HTTPS
  newHeaders.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  
  // Prevent MIME sniffing
  newHeaders.set("X-Content-Type-Options", "nosniff");
  
  // XSS Protection (Legacy but good to/ have)
  newHeaders.set("X-XSS-Protection", "1; mode=block");
  
  // Clickjacking protection
  newHeaders.set("X-Frame-Options", "DENY");
  
  // Referrer Policy
  newHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Content Security Policy (Basic)
  // We need to be careful not to break existing scripts/styles. 
  // For now, report-only or a permissive policy is safer until we audit all assets.
  // default-src 'self'; script-src 'self' 'unsafe-inline' (for now); style-src 'self' 'unsafe-inline';
  // newHeaders.set("Content-Security-Policy", "default-src 'self' https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:;");

  // CORS (If needed, though we serve same origin mostly)
  // newHeaders.set("Access-Control-Allow-Origin", "*");
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}
