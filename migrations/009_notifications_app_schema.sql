-- Align `notifications` with application code (functions/api/notifications, forum-notifications.js).
-- Older DBs may have 003/004 shapes (no title/text/link/icon/metadata) — SELECT then fails with 500.
-- This migration replaces the table with the canonical schema (same as 005_refactor_notifications_schema).
-- Existing notification rows are dropped; re-run after deploy if you need zero data loss (export first).

DROP TABLE IF EXISTS notifications;

CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    text TEXT,
    link TEXT,
    icon TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, is_read);
