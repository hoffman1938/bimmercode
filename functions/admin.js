/**
 * Serve admin.html at /admin and /admin/ with 200 (avoids redirect loops from
 * pretty-URL rules that 308 /admin → /admin).
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path !== "/admin") {
    return context.next();
  }

  const assetUrl = new URL("/admin.html", url.origin);
  const req = new Request(assetUrl, {
    method: context.request.method,
    headers: context.request.headers,
  });

  const res = await context.env.ASSETS.fetch(req);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}
