// functions/lib/permissions.js - RBAC Permission System

/**
 * Check if a user has a specific permission
 * @param {Object} env - Cloudflare environment (contains DB binding)
 * @param {string} userId - User ID
 * @param {string} permissionName - Permission to check (e.g., 'edit_any_post')
 * @returns {Promise<boolean>} - True if user has permission
 */
export async function hasPermission(env, userId, permissionName) {
  try {
    // Get user's role
    const user = await env.DB.prepare(
      'SELECT role_id FROM users WHERE id = ?'
    ).bind(userId).first();
    
    if (!user || !user.role_id) {
      return false;
    }
    
    // Check if role has the permission
    const permission = await env.DB.prepare(`
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ? AND p.name = ?
    `).bind(user.role_id, permissionName).first();
    
    return !!permission;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}

/**
 * Check if a user has ANY of the specified permissions
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User ID
 * @param {string[]} permissionNames - Array of permission names
 * @returns {Promise<boolean>} - True if user has at least one permission
 */
export async function hasAnyPermission(env, userId, permissionNames) {
  for (const permission of permissionNames) {
    if (await hasPermission(env, userId, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a user has ALL of the specified permissions
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User ID
 * @param {string[]} permissionNames - Array of permission names
 * @returns {Promise<boolean>} - True if user has all permissions
 */
export async function hasAllPermissions(env, userId, permissionNames) {
  for (const permission of permissionNames) {
    if (!(await hasPermission(env, userId, permission))) {
      return false;
    }
  }
  return true;
}

/**
 * Get all permissions for a user
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} - Array of permission names
 */
export async function getUserPermissions(env, userId) {
  try {
    const user = await env.DB.prepare(
      'SELECT role_id FROM users WHERE id = ?'
    ).bind(userId).first();
    
    if (!user || !user.role_id) {
      return [];
    }
    
    const permissions = await env.DB.prepare(`
      SELECT p.name FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = ?
    `).bind(user.role_id).all();
    
    return permissions.results.map(p => p.name);
  } catch (error) {
    console.error('Get permissions error:', error);
    return [];
  }
}

/**
 * Check if a user has a specific role level or higher
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User ID
 * @param {number} minLevel - Minimum role level (1=user, 2=mod, 3=senior_mod, 4=admin, 5=super_admin)
 * @returns {Promise<boolean>} - True if user has required level or higher
 */
export async function hasRoleLevel(env, userId, minLevel) {
  try {
    const result = await env.DB.prepare(`
      SELECT r.level FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).bind(userId).first();
    
    return result && result.level >= minLevel;
  } catch (error) {
    console.error('Role level check error:', error);
    return false;
  }
}

/**
 * If `roles` rows are missing (migrations not applied) but `users.role_id` is set,
 * we still return a valid role so admin gate and login JWT stay consistent.
 */
const SYNTHETIC_ROLES_BY_ID = {
  user_role: { id: "user_role", name: "user", display_name: "User", level: 1 },
  moderator_role: { id: "moderator_role", name: "moderator", display_name: "Moderator", level: 2 },
  senior_moderator_role: {
    id: "senior_moderator_role",
    name: "senior_moderator",
    display_name: "Senior Moderator",
    level: 3,
  },
  admin_role: { id: "admin_role", name: "admin", display_name: "Administrator", level: 4 },
  super_admin_role: { id: "super_admin_role", name: "super_admin", display_name: "Super Administrator", level: 5 },
};

/** Optional env `ADMIN_PANEL_EMAILS` — comma/semicolon list, grants `admin_role` (e.g. before DB role is fixed). */
function emailInAdminAllowlist(env, email) {
  if (!email || !env.ADMIN_PANEL_EMAILS) return false;
  const e = String(email).trim().toLowerCase();
  return String(env.ADMIN_PANEL_EMAILS)
    .split(/[,;]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(e);
}

/**
 * Get user's role information
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - Role object {id, name, display_name, level}
 */
export async function getUserRole(env, userId) {
  try {
    const user = await env.DB.prepare("SELECT role_id, email FROM users WHERE id = ?")
      .bind(userId)
      .first();
    if (!user) return null;

    // Allowlist first: still `user_role` in DB until migration / manual UPDATE
    if (user.email && emailInAdminAllowlist(env, user.email)) {
      return { ...SYNTHETIC_ROLES_BY_ID.admin_role };
    }

    const result = await env.DB.prepare(`
      SELECT r.* FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = ?
    `).bind(userId).first();

    if (result) return result;

    if (user.role_id && SYNTHETIC_ROLES_BY_ID[user.role_id]) {
      return { ...SYNTHETIC_ROLES_BY_ID[user.role_id] };
    }
    return null;
  } catch (error) {
    console.error("Get user role error:", error);
    return null;
  }
}

/**
 * Middleware to require specific permission
 * Returns a function that can be used in API routes
 * @param {string} permissionName - Required permission
 * @returns {Function} - Middleware function
 */
export function requirePermission(permissionName) {
  return async (context, userId) => {
    const { env } = context;
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const hasAccess = await hasPermission(env, userId, permissionName);
    
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return null; // Permission granted
  };
}

/**
 * Middleware to require specific role level
 * @param {number} minLevel - Minimum required level
 * @returns {Function} - Middleware function
 */
export function requireRoleLevel(minLevel) {
  return async (context, userId) => {
    const { env } = context;
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const hasAccess = await hasRoleLevel(env, userId, minLevel);
    
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: 'Insufficient role level' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return null; // Permission granted
  };
}

/**
 * Check if user can perform action on content (owns it or has permission)
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User ID
 * @param {string} contentOwnerId - Owner of the content
 * @param {string} permissionName - Permission needed if not owner
 * @returns {Promise<boolean>} - True if user can perform action
 */
export async function canModifyContent(env, userId, contentOwnerId, permissionName) {
  // Owner can always modify their own content
  if (userId === contentOwnerId) {
    return true;
  }
  
  // Otherwise, check if user has the required permission
  return await hasPermission(env, userId, permissionName);
}
