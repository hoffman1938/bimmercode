-- Drop old table
DROP TABLE IF EXISTS notifications;

-- Create new generic table
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'reply', 'like', 'system', etc.
    title TEXT,
    text TEXT,
    link TEXT,
    icon TEXT, -- 'fa-reply', etc.
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON string for extra data
);

-- Index for performance
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
