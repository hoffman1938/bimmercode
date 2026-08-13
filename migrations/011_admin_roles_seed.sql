-- Ensure core RBAC roles exist and grant admin to the platform owner account.
-- Safe to re-run: INSERT OR IGNORE for roles; UPDATE is idempotent for that email.

INSERT OR IGNORE INTO roles (id, name, display_name, level) VALUES
  ('user_role', 'user', 'User', 1),
  ('moderator_role', 'moderator', 'Moderator', 2),
  ('admin_role', 'admin', 'Administrator', 3),
  ('super_admin_role', 'super_admin', 'Super Administrator', 4);

UPDATE users SET role_id = 'super_admin_role' WHERE lower(email) = lower('giowulaia76@gmail.com');
