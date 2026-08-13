-- Skipped (no-op): topic "shadow" rows in `posts` + posts_fts + mirror-aware triggers.
--
-- Remote D1 has returned SQLITE_CORRUPT_VTAB for this migration (even after dropping
-- and recreating `posts_fts`), which usually means the SQLite file or FTS5 state is
-- damaged. Any step that references FTS5 (including DROP/CREATE/INSERT on posts_fts,
-- or triggers that write to it) can fail.
--
-- This placeholder advances `d1_migrations` so later migrations
--   008_moderation.sql, 009_*, 010_*, 011_admin_roles_seed.sql
-- can apply.
--
-- To apply the intended schema/data after restoring or replacing the D1 database, run
--   scripts/sql/008_forum_opening_post_shadow_backfill.sql
-- via: npx wrangler d1 execute bmw-db --remote --file=scripts/sql/008_forum_opening_post_shadow_backfill.sql
-- (only on a database where `PRAGMA integrity_check;` is ok and FTS is not corrupt)

SELECT 1;
