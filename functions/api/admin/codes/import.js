import { authenticateAdminRequest } from "../../../lib/admin-gate.js";
import { importCodesFromJson } from "../../../lib/dtc-codes.js";

/** POST /api/admin/codes/import — seed D1 from static JSON assets */
export async function onRequestPost(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const { request, env } = context;
  const origin = new URL(request.url).origin;
  let total = 0;
  try {
    for (const path of ["/data/codes.json", "/data/data.json"]) {
      const res = await fetch(`${origin}${path}`);
      if (!res.ok) continue;
      const j = await res.json();
      if (path.endsWith("data.json") && !j.codes) {
        const list = Object.entries(j).map(([code, v]) => ({
          code,
          ...(typeof v === "object" ? v : { title: { en: String(v) } }),
        }));
        total += await importCodesFromJson(env.DB, { codes: list });
      } else {
        total += await importCodesFromJson(env.DB, j);
      }
    }
    return new Response(JSON.stringify({ success: true, imported: total }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
