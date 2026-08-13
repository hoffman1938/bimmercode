-- Run on production if migration 017 was not applied via wrangler:
--   npx wrangler d1 execute bmw-db --remote --file=scripts/sql/017_drop_fts_sync_triggers.sql

DROP TRIGGER IF EXISTS posts_ai;
DROP TRIGGER IF EXISTS posts_ad;
DROP TRIGGER IF EXISTS posts_au;
DROP TRIGGER IF EXISTS topics_ai;
DROP TRIGGER IF EXISTS topics_ad;
DROP TRIGGER IF EXISTS topics_au;
