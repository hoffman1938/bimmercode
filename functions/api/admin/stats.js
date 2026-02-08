// functions/api/admin/stats.js - Admin Dashboard Statistics
import { verifyToken } from "../../lib/jwt.js";
import { requirePermission } from "../../lib/permissions.js";

export async function onRequestGet(context) {
    const { request, env } = context;

    // 1. Authenticate
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = await verifyToken(token, env.JWT_SECRET || "secret-dev-key");
    if (!decoded) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });

    const userId = decoded.id;

    // 2. Permission Check (Any admin/mod with dashboard access)
    // using 'view_audit_logs' as a proxy for generic admin read access, or 'view_user_details'
    const checkPermission = requirePermission('view_user_details');
    const authError = await checkPermission(context, userId);
    if (authError) return authError;

    try {
        // Parallel queries for performance
        const [
            totalUsers,
            activeUsers,
            bannedUsers,
            pendingReports,
            totalTopics,
            totalPosts
        ] = await Promise.all([
            env.DB.prepare("SELECT COUNT(*) as count FROM users").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE is_active = 1").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM users WHERE role_id = 'banned' OR is_active = 0").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM topics").first('count'),
            env.DB.prepare("SELECT COUNT(*) as count FROM posts").first('count')
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
                    posts: totalPosts
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
