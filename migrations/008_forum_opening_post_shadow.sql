-- Mirror each topic's body in `posts` (id = topic id) so reactions + FKs work.
-- Replies are posts where id != topic_id. Denormalized reply_count must NOT count the mirror.

-- 1) Backfill: one shadow row per topic (id equals topic_id)
INSERT OR IGNORE INTO posts (id, topic_id, user_id, username, content, lang, created_at, updated_at)
SELECT t.id, t.id, t.user_id, t.username, t.content, t.lang, t.created_at, t.updated_at
  FROM topics t
 WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.id = t.id);

-- 2) Recalculate reply_count (only real replies, not the mirror)
UPDATE topics
   SET reply_count = (
         SELECT COUNT(*) FROM posts p
          WHERE p.topic_id = topics.id AND p.id != p.topic_id
       );

-- 3) Replace triggers so the mirror does not increment reply_count / bump last_reply
DROP TRIGGER IF EXISTS posts_after_insert;
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

DROP TRIGGER IF EXISTS posts_after_delete;
CREATE TRIGGER posts_after_delete
AFTER DELETE ON posts
BEGIN
  UPDATE topics
     SET reply_count = MAX(0, reply_count - 1)
   WHERE id = old.topic_id
     AND old.id != old.topic_id;
END;
