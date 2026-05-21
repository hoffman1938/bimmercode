/**
 * GET /api/admin/dashboard — extended overview widgets
 */
import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequestGet(context) {
  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;
  const db = context.env.DB;

  try {
    const q = async (sql, ...bind) => {
      try {
        return await db.prepare(sql).bind(...bind).all();
      } catch {
        return { results: [] };
      }
    };
    const one = async (sql, ...bind) => {
      try {
        return await db.prepare(sql).bind(...bind).first();
      } catch {
        return null;
      }
    };

    const [
      newUsers24h,
      newUsers7d,
      newTopics24h,
      newPosts24h,
      pendingReports,
      pendingPosts,
      pendingListings,
    ] = await Promise.all([
      one("SELECT COUNT(*) AS c FROM users WHERE created_at > datetime('now', '-24 hours')"),
      one("SELECT COUNT(*) AS c FROM users WHERE created_at > datetime('now', '-7 days')"),
      one("SELECT COUNT(*) AS c FROM topics WHERE created_at > datetime('now', '-24 hours')"),
      one("SELECT COUNT(*) AS c FROM posts WHERE created_at > datetime('now', '-24 hours') AND id != topic_id"),
      one("SELECT COUNT(*) AS c FROM reports WHERE status = 'pending'"),
      one("SELECT 0 AS c"),
      one("SELECT COUNT(*) AS c FROM marketplace_listings WHERE status = 'pending'"),
    ]);

    const { results: topUsers } = await q(
      `SELECT u.id, u.username, u.reputation, COUNT(p.id) AS post_count
         FROM users u
         LEFT JOIN posts p ON p.user_id = u.id AND p.created_at > datetime('now', '-7 days')
        GROUP BY u.id
        ORDER BY post_count DESC
        LIMIT 8`
    );

    const { results: topTopics } = await q(
      `SELECT t.id, t.title, t.reply_count, t.views, t.category
         FROM topics t
        WHERE (t.is_archived IS NULL OR t.is_archived = 0)
        ORDER BY t.reply_count DESC, t.views DESC
        LIMIT 8`
    );

    const { results: activeCategories } = await q(
      `SELECT t.category, COUNT(*) AS topic_count
         FROM topics t
        WHERE t.created_at > datetime('now', '-7 days')
        GROUP BY t.category
        ORDER BY topic_count DESC
        LIMIT 8`
    );

    const { results: topSearches } = await q(
      `SELECT query, COUNT(*) AS cnt FROM search_queries
        WHERE created_at > datetime('now', '-7 days')
        GROUP BY query ORDER BY cnt DESC LIMIT 10`
    );

    const { results: recentAudit } = await q(
      `SELECT action, COUNT(*) AS cnt FROM audit_logs
        WHERE created_at > datetime('now', '-24 hours')
        GROUP BY action ORDER BY cnt DESC LIMIT 10`
    );

    const suspicious = await one(
      `SELECT COUNT(*) AS c FROM users
        WHERE created_at > datetime('now', '-1 day')
          AND (reputation IS NULL OR reputation < 5)
          AND is_active = 1`
    );

    return new Response(
      JSON.stringify({
        success: true,
        widgets: {
          new_users_24h: newUsers24h?.c ?? 0,
          new_users_7d: newUsers7d?.c ?? 0,
          new_topics_24h: newTopics24h?.c ?? 0,
          new_posts_24h: newPosts24h?.c ?? 0,
          pending_reports: pendingReports?.c ?? 0,
          pending_posts: pendingPosts?.c ?? 0,
          pending_listings: pendingListings?.c ?? 0,
          suspicious_accounts: suspicious?.c ?? 0,
          top_users: topUsers || [],
          top_topics: topTopics || [],
          active_categories: activeCategories || [],
          top_searches: topSearches || [],
          recent_audit_actions: recentAudit || [],
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
