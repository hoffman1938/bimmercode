/**
 * Blocking gate for admin.html — runs in <head> before the panel is painted.
 * Non-admins must not see admin UI (redirect). Admins stay hidden until /api/admin/stats OK.
 */
(function () {
  var LOGIN = "/index.html?need_login=1";
  var DENY = "/index.html?admin=denied";
  /** Roles that can never use the admin panel (fast redirect before paint). */
  var BLOCKED_ROLES = { user_role: 1, moderator_role: 1, senior_moderator_role: 1 };

  var token = localStorage.getItem("auth_token");
  if (!token) {
    location.replace(LOGIN);
    return;
  }

  var roleId = null;
  try {
    var u = JSON.parse(localStorage.getItem("user_data") || "null");
    roleId = u && u.role_id;
  } catch (_) {}

  if (roleId && BLOCKED_ROLES[roleId]) {
    location.replace(DENY);
    return;
  }

  document.documentElement.classList.add("admin-gate-pending");
})();
