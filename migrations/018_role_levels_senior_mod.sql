-- Role hierarchy: user(1) < mod(2) < senior_mod(3) < admin(4) < super_admin(5)

INSERT OR IGNORE INTO roles (id, name, display_name, level) VALUES
  ('senior_moderator_role', 'senior_moderator', 'Senior Moderator', 3);

UPDATE roles SET level = 1 WHERE id = 'user_role';
UPDATE roles SET level = 2 WHERE id = 'moderator_role';
UPDATE roles SET level = 3 WHERE id = 'senior_moderator_role';
UPDATE roles SET level = 4 WHERE id = 'admin_role';
UPDATE roles SET level = 5 WHERE id = 'super_admin_role';
