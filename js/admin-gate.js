/**
 * Blocking gate for admin.html — runs in <head> before paint.
 * - No token → login (regular users never see admin chrome).
 * - With token → hide UI until /api/admin/stats confirms admin/super_admin (no role guess from stale cache).
 */
(function () {
  var LOGIN = "/index.html?need_login=1&return=" + encodeURIComponent("/admin.html");

  function safeReplace(url) {
    var target = new URL(url, window.location.origin).href;
    try {
      if (window.self !== window.top) {
        window.top.location.replace(target);
      } else {
        window.location.replace(target);
      }
    } catch (_) {
      window.location.href = target;
    }
  }

  var token = localStorage.getItem("auth_token");
  if (!token) {
    safeReplace(LOGIN);
    return;
  }

  document.documentElement.classList.add("admin-gate-pending");
})();
