/**
 * Admin user list role filters — supports canonical *_role ids and legacy short ids.
 */
export const ROLE_FILTER_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "super_admin_role", label: "Super Admin" },
  { value: "admin_role", label: "Administrator" },
  { value: "senior_moderator_role", label: "Senior Moderator" },
  { value: "moderator_role", label: "Moderator" },
  { value: "bmw_technician_role", label: "BMW Technician" },
  { value: "verified_owner_role", label: "Verified Owner" },
  { value: "vendor_role", label: "Vendor" },
  { value: "user_role", label: "User" },
  { value: "banned", label: "Banned" },
];

/** Map filter value → role_id values to match in SQL IN (...) */
export const ROLE_FILTER_IDS = {
  user_role: ["user_role", "user"],
  moderator_role: ["moderator_role", "moderator"],
  senior_moderator_role: ["senior_moderator_role", "senior_moderator"],
  admin_role: ["admin_role", "admin"],
  super_admin_role: ["super_admin_role", "super_admin"],
  bmw_technician_role: ["bmw_technician_role"],
  verified_owner_role: ["verified_owner_role"],
  vendor_role: ["vendor_role"],
};

export function roleIdsForFilter(filterValue) {
  if (!filterValue || filterValue === "banned") return null;
  return ROLE_FILTER_IDS[filterValue] || [filterValue];
}

export function buildRoleFilterClause(filterValue) {
  if (!filterValue) return { clause: "", params: [] };
  if (filterValue === "banned") {
    return { clause: "is_active = 0", params: [] };
  }
  const ids = roleIdsForFilter(filterValue);
  if (!ids?.length) return { clause: "", params: [] };
  const placeholders = ids.map(() => "?").join(", ");
  return { clause: `role_id IN (${placeholders})`, params: ids };
}

/** Normalize legacy role_id for display */
export function normalizeRoleId(roleId) {
  const map = {
    user: "user_role",
    moderator: "moderator_role",
    senior_moderator: "senior_moderator_role",
    admin: "admin_role",
    super_admin: "super_admin_role",
  };
  return map[roleId] || roleId;
}
