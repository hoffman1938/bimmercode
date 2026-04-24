-- Legacy: `security_question` and `security_answer_hash` are in `schema.sql` on `users`.
-- Databases baselined on that schema already have these columns; ALTER fails with
-- duplicate column. No-op to advance d1_migrations.
SELECT 1;
