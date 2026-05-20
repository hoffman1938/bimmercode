-- Soft-delete columns on posts (schema.sql; missing on older production DBs).

ALTER TABLE posts ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN deleted_by TEXT;
ALTER TABLE posts ADD COLUMN deleted_at TEXT;
ALTER TABLE posts ADD COLUMN edited_by_moderator INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN moderator_edit_reason TEXT;
