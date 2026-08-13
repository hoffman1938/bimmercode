-- Some local DBs skipped 006_notification_mutes (conflicting 006_*.sql names, or partial apply).
-- Idempotent: safe if table already exists.
CREATE TABLE IF NOT EXISTS notification_mutes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_mutes_user_scope_target
  ON notification_mutes (user_id, scope, target_id);
CREATE INDEX IF NOT EXISTS idx_notification_mutes_user ON notification_mutes (user_id);
