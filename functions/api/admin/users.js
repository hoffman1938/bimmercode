// functions/api/admin/users.js - List Users API (Protected)
import { authenticateAdminRequest } from "../../lib/admin-gate.js";
import { buildRoleFilterClause } from "../../lib/role-filters.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  const auth = await authenticateAdminRequest(context);
  if (!auth.ok) return auth.response;

  // Logic: List Users
  try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit")) || 20;
      const offset = parseInt(url.searchParams.get("offset")) || 0;
      const rawSearch = url.searchParams.get("search");
      const search = rawSearch && String(rawSearch).trim() ? String(rawSearch).trim() : null;
      const roleFilter = url.searchParams.get("role");
      
      let query = `
        SELECT 
            id, username, email, first_name, last_name, 
            role_id, reputation, created_at, last_login, is_active 
        FROM users
      `;
      
      let whereClauses = [];
      let params = [];
      
      // 1. Role Filter (canonical + legacy role_id values)
      if (roleFilter) {
          const rf = buildRoleFilterClause(roleFilter);
          if (rf.clause) {
              whereClauses.push(rf.clause);
              params.push(...rf.params);
          }
      }
      
      const ipSearch = url.searchParams.get("ip") === "1" || (search && /^\d{1,3}(\.\d{1,3}){3}$/.test(search.trim()));

      // 2. Search Logic (Smart + IP via login_attempts)
      if (search) {
          const searchLower = search.toLowerCase();
          if (ipSearch) {
              whereClauses.push(
                `id IN (
                  SELECT DISTINCT u2.id FROM users u2
                  INNER JOIN login_attempts la
                    ON la.identifier = u2.email OR la.identifier = u2.username
                  WHERE la.ip_address LIKE ?
                )`
              );
              params.push(`%${search.trim()}%`);
          } else {
          let searchConditions = [];
          
          searchConditions.push("username LIKE ?");
          params.push(`%${search}%`);
          searchConditions.push("email LIKE ?");
          params.push(`%${search}%`);
          searchConditions.push("role_id LIKE ?");
          params.push(`%${search}%`);
          try {
            await env.DB.prepare("SELECT vin FROM users LIMIT 1").first();
            searchConditions.push("vin LIKE ?");
            params.push(`%${search}%`);
          } catch {
            /* vin column not migrated yet */
          }
          
          if (searchLower.includes('ban') || searchLower.includes('block')) {
              searchConditions.push("is_active = 0");
          }
          if (searchLower.includes('active')) {
              searchConditions.push("is_active = 1");
          }
          
          whereClauses.push(`(${searchConditions.join(" OR ")})`);
          }
      }
      
      // Assemble Query
      if (whereClauses.length > 0) {
          query += " WHERE " + whereClauses.join(" AND ");
      }
      
      query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);
      
      const { results } = await env.DB.prepare(query).bind(...params).all();
      
      // Get total count (using same filters)
      let countQuery = "SELECT COUNT(*) as total FROM users";
      let countParams = [];
      
      if (whereClauses.length > 0) {
          countQuery += " WHERE " + whereClauses.join(" AND ");
          // Params for count are same as main query minus limit/offset
          countParams = params.slice(0, params.length - 2); 
      }
      
      const total = await env.DB.prepare(countQuery).bind(...countParams).first('total');
      
      return new Response(JSON.stringify({
          success: true,
          users: results,
          pagination: {
              total,
              limit,
              offset
          }
      }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
      });
      
  } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
