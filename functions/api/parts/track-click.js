/**
 * Track affiliate link clicks
 * POST /api/parts/track-click
 */
export async function onRequestPost({ request, env }) {
  try {
    const { link_id, marketplace } = await request.json();

    if (!link_id || !marketplace) {
      return new Response(JSON.stringify({ error: 'link_id and marketplace required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update click counter in D1 (best effort)
    await env.DB.prepare(
      `UPDATE part_affiliate_links SET click_count = click_count + 1, last_clicked_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(link_id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    // Never break the user flow for analytics
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
