/**
 * RBAC rules for changing another user's role (admin UI + API).
 *
 * Hierarchy (low → high): user, moderator, senior moderator, administrator, super admin.
 */

export const ROLE_LEVEL_BY_ID = {
  user_role: 1,
  moderator_role: 2,
  senior_moderator_role: 3,
  admin_role: 4,
  super_admin_role: 5,
  banned: 0,
};

export function roleLevel(roleId) {
  return ROLE_LEVEL_BY_ID[roleId] ?? 0;
}

export function isSuperAdminRole(roleId) {
  return roleId === "super_admin_role";
}

export function isAdminTierRole(roleId) {
  return roleId === "admin_role" || roleId === "super_admin_role";
}

export function isModeratorTierRole(roleId) {
  return roleId === "moderator_role" || roleId === "senior_moderator_role";
}

/**
 * May the actor change role_id of a user who currently has targetCurrentRoleId?
 */
export function canModifyUserWithRole(actorRoleId, targetCurrentRoleId) {
  if (!actorRoleId || !targetCurrentRoleId) return false;

  if (isSuperAdminRole(targetCurrentRoleId)) {
    return actorRoleId === "super_admin_role";
  }

  if (targetCurrentRoleId === "admin_role") {
    return actorRoleId === "super_admin_role" || actorRoleId === "admin_role";
  }

  if (isModeratorTierRole(actorRoleId)) {
    return !isAdminTierRole(targetCurrentRoleId);
  }

  if (actorRoleId === "admin_role" || actorRoleId === "super_admin_role") {
    return true;
  }

  return false;
}

/**
 * May the actor set a user's role to newRoleId?
 * @param {{ superPromoAllowed?: boolean }} opts — bootstrap email list for super_admin grant
 */
export function canAssignRole(actorRoleId, newRoleId, opts = {}) {
  if (!actorRoleId || !newRoleId) return { ok: false, error: "Invalid role" };

  if (isSuperAdminRole(newRoleId) && actorRoleId !== "super_admin_role") {
    if (!opts.superPromoAllowed) {
      return { ok: false, error: "Only Super Administrator can assign Super Administrator role" };
    }
  }

  if (isModeratorTierRole(actorRoleId) && isAdminTierRole(newRoleId)) {
    return {
      ok: false,
      error: "Moderators cannot assign Administrator or Super Administrator roles",
    };
  }

  if (actorRoleId !== "super_admin_role") {
    const actorLvl = roleLevel(actorRoleId);
    const newLvl = roleLevel(newRoleId);
    if (newLvl > actorLvl && !(opts.superPromoAllowed && isSuperAdminRole(newRoleId))) {
      return { ok: false, error: "Cannot assign a role higher than your own" };
    }
  }

  return { ok: true };
}

/**
 * Full check before UPDATE users.role_id
 */
export function validateRoleChange({
  actorRoleId,
  targetCurrentRoleId,
  newRoleId,
  superPromoAllowed = false,
}) {
  if (newRoleId === targetCurrentRoleId) {
    return { ok: true };
  }

  if (!canModifyUserWithRole(actorRoleId, targetCurrentRoleId)) {
    if (isSuperAdminRole(targetCurrentRoleId)) {
      return { ok: false, error: "Cannot change role of a Super Administrator" };
    }
    if (targetCurrentRoleId === "admin_role" && isModeratorTierRole(actorRoleId)) {
      return {
        ok: false,
        error: "Cannot change role of an Administrator or Super Administrator",
      };
    }
    return { ok: false, error: "You cannot change this user's role" };
  }

  return canAssignRole(actorRoleId, newRoleId, { superPromoAllowed });
}
