// functions/api/admin/users.js - List Users API (Protected)
import { verifyToken } from "../../lib/jwt.js";
import { requirePermission } from "../../lib/permissions.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  
  // 1. Authenticate
  const authHeader = request.headers.get("Authorization");
  console.log("Admin API: Auth Header:", authHeader); // DEBUG

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Admin API: No valid auth header"); // DEBUG
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  
  const token = authHeader.split(" ")[1];
  const secret = env.JWT_SECRET || "secret-dev-key";
  console.log("Admin API: Verifying token with secret length:", secret.length); // DEBUG

  const decoded = await verifyToken(token, secret);
  console.log("Admin API: Decoded:", decoded); // DEBUG
  
  if (!decoded) {
      console.log("Admin API: Token verification failed"); // DEBUG
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401 });
  }
  
  const userId = decoded.id;
  
  // 2. Authorization (RBAC)
  // Check 'view_user_details' permission
  const checkPermission = requirePermission('view_user_details');
  const errorResponse = await checkPermission(context, userId);
  
  if (errorResponse) return errorResponse;
  
  // 3. Logic: List Users
  try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get("limit")) || 20;
      const offset = parseInt(url.searchParams.get("offset")) || 0;
      const search = url.searchParams.get("search");
      const roleFilter = url.searchParams.get("role");
      
      let query = `
        SELECT 
            id, username, email, first_name, last_name, 
            role_id, reputation, created_at, last_login, is_active 
        FROM users
      `;
      
      let whereClauses = [];
      let params = [];
      
      // 1. Role Filter
      if (roleFilter) {
          if (roleFilter === 'banned') {
              whereClauses.push("is_active = 0");
          } else {
              whereClauses.push("role_id = ?");
              params.push(roleFilter);
          }
      }
      
      // 2. Search Logic (Smart)
      if (search) {
          const searchLower = search.toLowerCase();
          let searchConditions = [];
          
          // Match Username or Email
          searchConditions.push("username LIKE ?");
          params.push(`%${search}%`);
          searchConditions.push("email LIKE ?");
          params.push(`%${search}%`);
          
          // Match Role ID text
          searchConditions.push("role_id LIKE ?");
          params.push(`%${search}%`);
          
          // Match Status keywords
          if (searchLower.includes('ban') || searchLower.includes('block')) {
              searchConditions.push("is_active = 0");
          }
          if (searchLower.includes('active')) {
              searchConditions.push("is_active = 1");
          }
          
          whereClauses.push(`(${searchConditions.join(" OR ")})`);
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
