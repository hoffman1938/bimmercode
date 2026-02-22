-- schema.sql

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id TEXT DEFAULT 'user_role', -- Changed from 'role' to 'role_id' for RBAC
    car_model TEXT,
    avatar_url TEXT,
    bio TEXT,
    preferred_lang TEXT DEFAULT 'en',
    reputation INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    verification_token TEXT,
    email_verified BOOLEAN DEFAULT 0,
    security_question TEXT,
    security_answer_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    age INTEGER,
    city TEXT,
    country TEXT,
    bmw_year INTEGER,
    bmw_body TEXT,
    bmw_engine TEXT,
    privacy_level TEXT DEFAULT 'public',
    last_login TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    account_locked_until TIMESTAMP,
    remember_me_token TEXT
);

-- 2. ROLES (RBAC)
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    level INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. PERMISSIONS (RBAC)
CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ROLE PERMISSIONS (RBAC)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

-- 5. USER LEVELS (Reputation)
CREATE TABLE IF NOT EXISTS user_levels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    name_ru TEXT,
    name_ka TEXT,
    min_reputation INTEGER NOT NULL,
    max_reputation INTEGER,
    benefits TEXT,
    color TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. TOPICS
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL, -- Cached username
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    related_code TEXT,
    lang TEXT DEFAULT 'en',
    views INTEGER DEFAULT 0,
    is_solved BOOLEAN DEFAULT 0,
    is_pinned BOOLEAN DEFAULT 0,
    is_locked BOOLEAN DEFAULT 0,
    is_archived BOOLEAN DEFAULT 0,
    archived_by TEXT,
    archived_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 7. POSTS
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL, -- Cached username
    content TEXT NOT NULL,
    lang TEXT DEFAULT 'en',
    is_solution BOOLEAN DEFAULT 0,
    is_deleted BOOLEAN DEFAULT 0,
    deleted_by TEXT,
    deleted_at TIMESTAMP,
    edited_by_moderator BOOLEAN DEFAULT 0,
    moderator_edit_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (topic_id) REFERENCES topics(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 8. REPUTATION HISTORY
CREATE TABLE IF NOT EXISTS reputation_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    change_amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    related_entity_type TEXT, -- 'post', 'topic', 'warning'
    related_entity_id TEXT,
    moderator_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 9. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sender_id TEXT,
    sender_name TEXT,
    type TEXT NOT NULL,
    topic_id TEXT,
    topic_title TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 10. POST LIKES (Deprecated in favor of generic reputation actions, but keeping for simple likes)
CREATE TABLE IF NOT EXISTS post_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
);

-- 11. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'user_banned', 'role_changed'
    target_entity_type TEXT,
    target_entity_id TEXT,
    target_user_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 12. LOGIN ATTEMPTS
CREATE TABLE IF NOT EXISTS login_attempts (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. WARNINGS
CREATE TABLE IF NOT EXISTS warnings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    severity TEXT NOT NULL, -- 'minor', 'major', 'severe'
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 14. REPORTS
CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL,
    reported_entity_type TEXT NOT NULL, -- 'post', 'topic', 'user'
    reported_entity_id TEXT NOT NULL,
    reported_user_id TEXT,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
    moderator_id TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY (reporter_id) REFERENCES users(id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);
CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_reputation_user ON reputation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, created_at);

-- 15. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- 16. CONTACT MESSAGES
CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. ANALYTICS EVENTS
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT, -- Nullable for guests
    event_type TEXT DEFAULT 'page_view', -- 'page_view', 'action'
    path TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address TEXT,
    country TEXT,
    device_type TEXT, -- 'mobile', 'desktop', 'tablet'
    meta TEXT, -- JSON extra data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);