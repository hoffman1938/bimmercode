-- Auth/login columns (may already exist on some DBs).
-- If migrate fails on "duplicate column", skip that line in D1 Studio and re-run apply.

ALTER TABLE users ADD COLUMN last_login TEXT;
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN account_locked_until TEXT;
