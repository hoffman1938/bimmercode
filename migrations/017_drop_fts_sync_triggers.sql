-- Fix SQLITE_CORRUPT_VTAB on forum DELETE/UPDATE/INSERT when posts_fts/topics_fts are damaged.
-- Forum list search already falls back to LIKE if FTS is unavailable (topics.js).

DROP TRIGGER IF EXISTS posts_ai;
DROP TRIGGER IF EXISTS posts_ad;
DROP TRIGGER IF EXISTS posts_au;
DROP TRIGGER IF EXISTS topics_ai;
DROP TRIGGER IF EXISTS topics_ad;
DROP TRIGGER IF EXISTS topics_au;
