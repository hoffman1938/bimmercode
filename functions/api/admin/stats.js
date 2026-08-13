// functions/api/admin/stats.js - Admin Dashboard Statistics
import { authenticateAdminRequest } from "../../lib/admin-gate.js";

export async function onRequestGet(context) {
    const { env } = context;

    const auth = await authenticateAdminRequest(context);
    if (!auth.ok) return auth.response;

    try {
        // Parallel queries for performance
        const [
            totalUsers,
            activeUsers,
            bannedUsers,
            pendingReports,
            totalTopics,
            totalPosts,
            newUsers24h,
            newTopics24h,
            newPosts24h
        ] = await Promise.all([
            env.DB.prepare("SELECT COUNT(*) as count FROM users").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE is_active = 1").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role_id = 'banned' OR is_active = 0").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM topics").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM posts").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE created_at > datetime('now', '-24 hours')").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM topics WHERE created_at > datetime('now', '-24 hours')").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM posts WHERE created_at > datetime('now', '-24 hours')").first('count')
        ]);

        return new Response(JSON.stringify({
            success: true,
            stats: {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    banned: bannedUsers
                },
                content: {
                    topics: totalTopics,
                    posts: totalPosts,
                    new_topics_24h: newTopics24h?.count ?? newTopics24h ?? 0,
                    new_posts_24h: newPosts24h?.count ?? newPosts24h ?? 0
                },
                growth: {
                    new_users_24h: newUsers24h?.count ?? newUsers24h ?? 0
                },
                moderation: {
                    pending_reports: pendingReports
                }
            }
        }), { 
            headers: { "Content-Type": "application/json" } 
        });

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
