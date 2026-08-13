-- Optional manual run after D1 is healthy (integrity_check ok, FTS not corrupt).
-- See migrations/008_forum_opening_post_shadow.sql (no-op in automatic chain).
--
-- npx wrangler d1 execute bmw-db --remote --file=scripts/sql/008_forum_opening_post_shadow_backfill.sql

DROP TRIGGER IF EXISTS posts_ai;
DROP TRIGGER IF EXISTS posts_ad;
DROP TRIGGER IF EXISTS posts_au;
DROP TRIGGER IF EXISTS posts_after_insert;
DROP TRIGGER IF EXISTS posts_after_delete;

DROP TABLE IF EXISTS posts_fts;

CREATE VIRTUAL TABLE posts_fts
USING fts5(
  content,
  content='posts', content_rowid='rowid',
  tokenize="unicode61 remove_diacritics 2"
);

INSERT OR IGNORE INTO posts (id, topic_id, user_id, username, content, lang, created_at, updated_at)
SELECT t.id, t.id, t.user_id, t.username, t.content, t.lang, t.created_at, t.updated_at
  FROM topics t
 WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.id = t.id);

UPDATE topics
   SET reply_count = (
         SELECT COUNT(*) FROM posts p
          WHERE p.topic_id = topics.id AND p.id != p.topic_id
       );

INSERT INTO posts_fts (rowid, content)
SELECT rowid, content FROM posts;

CREATE TRIGGER posts_after_insert
AFTER INSERT ON posts
BEGIN
  UPDATE topics
     SET reply_count = reply_count + 1,
         last_reply_at = new.created_at,
         last_reply_user_id = new.user_id,
         last_reply_username = new.username
   WHERE id = new.topic_id
     AND new.id != new.topic_id;
END;

CREATE TRIGGER posts_after_delete
AFTER DELETE ON posts
BEGIN
  UPDATE topics
     SET reply_count = MAX(0, reply_count - 1)
   WHERE id = old.topic_id
     AND old.id != old.topic_id;
END;

CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO posts_fts(rowid, content) VALUES (new.rowid, new.content);
END;
