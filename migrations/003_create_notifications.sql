-- Migration: Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,         -- Who receives the notification
    actor_id TEXT,                 -- Who performed the action (optional)
    actor_name TEXT,               -- Cached username of actor
    type TEXT NOT NULL,            -- 'reply', 'like', 'solution'
    entity_id TEXT NOT NULL,       -- ID of topic or post
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
