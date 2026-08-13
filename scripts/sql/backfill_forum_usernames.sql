-- Sync denormalized forum usernames from users (run once if topics still show old names in DB exports).
--   npx wrangler d1 execute bmw-db --remote --file=scripts/sql/backfill_forum_usernames.sql

UPDATE topics
   SET username = (SELECT username FROM users WHERE users.id = topics.user_id)
 WHERE user_id IS NOT NULL;

UPDATE posts
   SET username = (SELECT username FROM users WHERE users.id = posts.user_id)
 WHERE user_id IS NOT NULL;

UPDATE topics
   SET last_reply_username = (SELECT username FROM users WHERE users.id = topics.last_reply_user_id)
 WHERE last_reply_user_id IS NOT NULL;
