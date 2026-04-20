-- migrations/008_moderation.sql
-- Stage-4 moderation additions.
--
-- The existing schema (schema.sql) already has `reports` and `warnings` tables
-- with slightly different column names. We keep those and only add what's new:
--   * user_bans  — timed bans (complements existing `account_locked_until`)
--   * helper indexes on reports / warnings for the moderation queue
--
-- Safe to re-run.

------------------------------------------------------------------
-- 1. Timed bans (richer than the single `account_locked_until` flag on users)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_bans (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  issued_by       TEXT NOT NULL,
  reason          TEXT NOT NULL,
  banned_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TEXT, -- NULL = permanent
  lifted_at       TEXT,
  lifted_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_bans_active   ON user_bans(user_id, expires_at);

------------------------------------------------------------------
-- 2. Indexes that speed up the moderation queue
------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reports_status_date   ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_entity        ON reports(reported_entity_type, reported_entity_id);
CREATE INDEX IF NOT EXISTS idx_warnings_user         ON warnings(user_id, created_at DESC);
