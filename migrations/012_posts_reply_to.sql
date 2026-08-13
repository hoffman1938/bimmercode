-- Optional: which post in the same thread this reply targets (for “replying to @user” UI).

ALTER TABLE posts ADD COLUMN reply_to_post_id TEXT;
