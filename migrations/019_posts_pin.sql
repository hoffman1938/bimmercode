-- Allow staff to pin individual replies (topics already have is_pinned).

ALTER TABLE posts ADD COLUMN is_pinned INTEGER DEFAULT 0;
