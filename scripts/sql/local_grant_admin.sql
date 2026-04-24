-- Local D1: grant admin to an existing user (same idea as migrations/011_admin_roles_seed.sql).
-- Run:
--   npx wrangler d1 execute bmw-db --local --file=scripts/sql/local_grant_admin.sql
--
-- Replace the email if needed.

INSERT OR IGNORE INTO roles (id, name, display_name, level) VALUES
  ('user_role', 'user', 'User', 1),
  ('moderator_role', 'moderator', 'Moderator', 2),
  ('admin_role', 'admin', 'Administrator', 3),
  ('super_admin_role', 'super_admin', 'Super Administrator', 4);

UPDATE users SET role_id = 'super_admin_role' WHERE lower(email) = lower('giowulaia76@gmail.com');
