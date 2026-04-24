-- Legacy migration: `bio`, `car_model`, and `avatar_url` are already defined in `schema.sql`
-- on the `users` table. Databases created from the full schema (or an older apply) already
-- have these columns, so re-running `ALTER TABLE ... ADD COLUMN` causes:
--   duplicate column name: bio
-- This no-op exists only to mark migration 002 as applied in `d1_migrations`.
-- If you have a very old DB that truly lacks any of these, add them by hand in the D1 console.
SELECT 1;
