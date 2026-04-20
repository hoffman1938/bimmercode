-- migrations/008_moderation.sql
-- Adds tables required by the moderation dashboard (Stage 4):
--   * reports         — user-submitted reports on posts / topics
--   * user_warnings   — formal warnings issued by moderators
--   * user_bans       — timed bans (complements existing account_locked_until)
--
-- Safe to re-run: uses IF NOT EXISTS where SQLite supports it.

------------------------------------------------------------------
-- 1. Reports
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id              TEXT PRIMARY KEY,
  reporter_id     TEXT NOT NULL,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('post', 'topic', 'user')),
  entity_id       TEXT NOT NULL,
  reason          TEXT NOT NULL,
  details         TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution      TEXT,
  handled_by      TEXT,
  handled_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_status      ON reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_entity      ON reports(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter    ON reports(reporter_id, created_at DESC);

------------------------------------------------------------------
-- 2. User warnings (formal, visible in user profile)
------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_warnings (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  issued_by       TEXT NOT NULL,
  reason          TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'low'
                    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  related_post_id TEXT,
  related_topic_id TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_warnings_user       ON user_warnings(user_id, created_at DESC);

------------------------------------------------------------------
-- 3. Timed bans (extends existing `account_locked_until`)
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

CREATE INDEX IF NOT EXISTS idx_bans_active         ON user_bans(user_id, expires_at);
