-- Production sync: topics columns expected by forum API (schema.sql / forum v2).
-- Safe on DBs that already have these columns only if this migration has not run yet.
-- If apply fails with "duplicate column", that column already exists — add remaining columns manually in D1 console.

ALTER TABLE topics ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN archived_by TEXT;
ALTER TABLE topics ADD COLUMN archived_at TEXT;
ALTER TABLE topics ADD COLUMN reply_count INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN last_reply_at TEXT;
ALTER TABLE topics ADD COLUMN last_reply_user_id TEXT;
ALTER TABLE topics ADD COLUMN last_reply_username TEXT;
