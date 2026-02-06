-- Migration: Fix Notifications Schema
DROP TABLE IF EXISTS notifications;

CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sender_id TEXT,
    sender_name TEXT,
    type TEXT NOT NULL,
    entity_id TEXT,               -- ID of the post or related entity
    topic_id TEXT,                -- ID of the topic (for linking)
    topic_title TEXT,             -- Cached title
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
