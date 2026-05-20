-- Production sync: only archive columns (reply_count / last_reply_* often already exist from forum v2).
-- If one ALTER fails with "duplicate column", run the remaining lines manually in D1 Studio, then:
--   wrangler d1 migrations apply bmw-db --remote

ALTER TABLE topics ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN archived_by TEXT;
ALTER TABLE topics ADD COLUMN archived_at TEXT;
