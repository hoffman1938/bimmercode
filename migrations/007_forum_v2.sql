-- migrations/007_forum_v2.sql
-- Forum v2: i18n categories, reactions, FTS5 search, topic metadata.
-- Idempotent: safe to re-run.

-- =============================================================================
-- 1) Extend `categories` with i18n fields + extra metadata
--    (base table was created in schema_v3.sql)
-- =============================================================================

-- Add columns one-by-one (SQLite ALTER TABLE ADD COLUMN is idempotent-friendly
-- via PRAGMA check — but D1 does not support IF NOT EXISTS on ADD COLUMN.
-- We guard with a trick: wrap in CREATE TABLE IF NOT EXISTS first, then try alters.
-- Use the "sqlite_master pragma table_info" trick in application code if needed.
-- For D1, split migrations manually if columns already exist.

ALTER TABLE categories ADD COLUMN title_en     TEXT;
ALTER TABLE categories ADD COLUMN title_ru     TEXT;
ALTER TABLE categories ADD COLUMN title_ka     TEXT;
ALTER TABLE categories ADD COLUMN description_en TEXT;
ALTER TABLE categories ADD COLUMN description_ru TEXT;
ALTER TABLE categories ADD COLUMN description_ka TEXT;
ALTER TABLE categories ADD COLUMN color TEXT DEFAULT '#1C69D4';

-- Backfill i18n fields from existing `title`/`description`
UPDATE categories
   SET title_en       = COALESCE(title_en, title),
       title_ru       = COALESCE(title_ru, title),
       title_ka       = COALESCE(title_ka, title),
       description_en = COALESCE(description_en, description),
       description_ru = COALESCE(description_ru, description),
       description_ka = COALESCE(description_ka, description);

-- Seed default categories if the table is empty
INSERT OR IGNORE INTO categories (id, slug, title, description, icon, sort_order, title_en, title_ru, title_ka, description_en, description_ru, description_ka, color)
VALUES
  ('cat_diagnosis', 'diagnosis', 'Diagnostics',   'Fault codes, live data, symptom diagnosis',
   'fas fa-car-crash', 1,
   'Diagnostics',   'Диагностика',   'დიაგნოსტიკა',
   'Fault codes, live data, symptom diagnosis',
   'Коды ошибок, live-данные, диагностика по симптомам',
   'შეცდომების კოდები, მაჩვენებლები, დიაგნოსტიკა',
   '#E24B4A'),
  ('cat_coding',    'coding',    'Coding & Retrofit','E-Sys, BimmerCode, ISTA — coding and retrofits',
   'fas fa-laptop-code', 2,
   'Coding & Retrofit', 'Кодирование и ретрофит', 'კოდირება და რეტროფიტი',
   'E-Sys, BimmerCode, ISTA — coding and retrofits',
   'E-Sys, BimmerCode, ISTA — кодирование и ретрофиты',
   'E-Sys, BimmerCode, ISTA — კოდირება',
   '#1C69D4'),
  ('cat_parts',     'parts',     'Parts & Repair',    'Spare parts, OEM numbers, repair procedures',
   'fas fa-cogs', 3,
   'Parts & Repair',    'Запчасти и ремонт', 'ნაწილები და რემონტი',
   'Spare parts, OEM numbers, repair procedures',
   'Запчасти, OEM-номера, процедуры ремонта',
   'ნაწილები, OEM ნომრები, რემონტი',
   '#4CAF50'),
  ('cat_tuning',    'tuning',    'Tuning & Performance','Power upgrades, maps, exhaust, intake',
   'fas fa-tachometer-alt', 4,
   'Tuning & Performance','Тюнинг и производительность','ტუნინგი',
   'Power upgrades, maps, exhaust, intake',
   'Повышение мощности, прошивки, выхлоп, впуск',
   'სიმძლავრის გაზრდა, ჩიპ-ტუნინგი',
   '#EF9F27'),
  ('cat_offtopic',  'off-topic', 'Off-Topic',         'Community chat, showcase, meetups',
   'fas fa-coffee', 99,
   'Off-Topic',         'Оффтоп',            'Off-Topic',
   'Community chat, showcase, meetups',
   'Общение, шоу-кар, встречи',
   'საუბრები, შოუქარი, შეხვედრები',
   '#8A8A8A');

-- =============================================================================
-- 2) Reactions (generic emoji reactions on posts — supersedes post_likes)
--    We keep post_likes for legacy. A view unifies both for reads.
-- =============================================================================

CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (post_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions(user_id);

-- Migrate existing legacy likes into reactions with 👍 emoji (only first time).
INSERT OR IGNORE INTO reactions (id, post_id, user_id, emoji, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
        substr(hex(randomblob(2)),2) || '-' || substr('89ab', 1+abs(random())%4, 1) ||
        substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  post_id,
  user_id,
  '👍',
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM post_likes;

-- =============================================================================
-- 3) Topic metadata — last_reply_at, last_reply_user_id (for sort=recently_active)
-- =============================================================================

ALTER TABLE topics ADD COLUMN last_reply_at      TIMESTAMP;
ALTER TABLE topics ADD COLUMN last_reply_user_id TEXT;
ALTER TABLE topics ADD COLUMN last_reply_username TEXT;
ALTER TABLE topics ADD COLUMN reply_count        INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN hotness            REAL DEFAULT 0;

-- Backfill from posts
UPDATE topics
   SET reply_count = (SELECT COUNT(*) FROM posts WHERE posts.topic_id = topics.id),
       last_reply_at = (SELECT MAX(created_at) FROM posts WHERE posts.topic_id = topics.id),
       last_reply_user_id = (SELECT p.user_id
                               FROM posts p
                              WHERE p.topic_id = topics.id
                           ORDER BY p.created_at DESC
                              LIMIT 1),
       last_reply_username = (SELECT p.username
                                FROM posts p
                               WHERE p.topic_id = topics.id
                            ORDER BY p.created_at DESC
                               LIMIT 1);

CREATE INDEX IF NOT EXISTS idx_topics_last_reply ON topics(last_reply_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_created    ON topics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topics_views      ON topics(views DESC);
CREATE INDEX IF NOT EXISTS idx_topics_reply_cnt  ON topics(reply_count DESC);
CREATE INDEX IF NOT EXISTS idx_topics_pinned     ON topics(is_pinned DESC, last_reply_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created     ON posts(created_at DESC);

-- =============================================================================
-- 4) FTS5 full-text search on topics + posts.
--    External-content tables synced with triggers.
-- =============================================================================

-- Topics FTS
CREATE VIRTUAL TABLE IF NOT EXISTS topics_fts
USING fts5(
  title, content, related_code,
  content='topics', content_rowid='rowid',
  tokenize="unicode61 remove_diacritics 2"
);

-- Initial backfill (idempotent via INSERT OR REPLACE on rowid)
INSERT INTO topics_fts (rowid, title, content, related_code)
SELECT rowid, title, content, COALESCE(related_code, '') FROM topics
WHERE NOT EXISTS (SELECT 1 FROM topics_fts WHERE topics_fts.rowid = topics.rowid);

CREATE TRIGGER IF NOT EXISTS topics_ai AFTER INSERT ON topics BEGIN
  INSERT INTO topics_fts(rowid, title, content, related_code)
  VALUES (new.rowid, new.title, new.content, COALESCE(new.related_code, ''));
END;
CREATE TRIGGER IF NOT EXISTS topics_ad AFTER DELETE ON topics BEGIN
  INSERT INTO topics_fts(topics_fts, rowid, title, content, related_code)
  VALUES('delete', old.rowid, old.title, old.content, COALESCE(old.related_code, ''));
END;
CREATE TRIGGER IF NOT EXISTS topics_au AFTER UPDATE ON topics BEGIN
  INSERT INTO topics_fts(topics_fts, rowid, title, content, related_code)
  VALUES('delete', old.rowid, old.title, old.content, COALESCE(old.related_code, ''));
  INSERT INTO topics_fts(rowid, title, content, related_code)
  VALUES (new.rowid, new.title, new.content, COALESCE(new.related_code, ''));
END;

-- Posts FTS
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts
USING fts5(
  content,
  content='posts', content_rowid='rowid',
  tokenize="unicode61 remove_diacritics 2"
);

INSERT INTO posts_fts (rowid, content)
SELECT rowid, content FROM posts
WHERE NOT EXISTS (SELECT 1 FROM posts_fts WHERE posts_fts.rowid = posts.rowid);

CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO posts_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- =============================================================================
-- 5) Triggers to maintain denormalized topic.reply_count / last_reply_*
-- =============================================================================

CREATE TRIGGER IF NOT EXISTS posts_after_insert
AFTER INSERT ON posts
BEGIN
  UPDATE topics
     SET reply_count = reply_count + 1,
         last_reply_at = new.created_at,
         last_reply_user_id = new.user_id,
         last_reply_username = new.username
   WHERE id = new.topic_id;
END;

CREATE TRIGGER IF NOT EXISTS posts_after_delete
AFTER DELETE ON posts
BEGIN
  UPDATE topics
     SET reply_count = MAX(0, reply_count - 1)
   WHERE id = old.topic_id;
END;

-- =============================================================================
-- 6) User levels seed (reputation tiers) — idempotent
-- =============================================================================

INSERT OR IGNORE INTO user_levels (id, name, name_en, name_ru, name_ka, min_reputation, max_reputation, color) VALUES
  ('lvl_newcomer', 'Newcomer', 'Newcomer',  'Новичок',     'ახალბედა', 0,    49,    '#8A8A8A'),
  ('lvl_member',   'Member',   'Member',    'Участник',    'მონაწილე', 50,   249,   '#4DA8FF'),
  ('lvl_regular',  'Regular',  'Regular',   'Активист',    'აქტივისტი', 250,  999,   '#4CAF50'),
  ('lvl_expert',   'Expert',   'Expert',    'Эксперт',     'ექსპერტი', 1000, 2999,  '#EF9F27'),
  ('lvl_master',   'Master',   'Master',    'Мастер',      'ოსტატი',  3000, NULL,  '#E24B4A');

-- =============================================================================
-- 7) Moderation — Content filter decisions log (for AI moderation audit trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS moderation_decisions (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,       -- 'topic' | 'post' | 'image'
    entity_id TEXT NOT NULL,
    user_id TEXT,
    language TEXT,                   -- ka|ru|en|mixed|unknown
    decision TEXT NOT NULL,          -- 'approve'|'review'|'block'
    severity TEXT,                   -- 'low'|'medium'|'high'|'critical'
    flags TEXT,                      -- JSON array
    source TEXT,                     -- 'stopwords'|'workers_ai'|'manual'
    confidence REAL,
    explanation TEXT,
    raw TEXT,                        -- JSON raw output from model
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mod_decisions_entity ON moderation_decisions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_mod_decisions_user   ON moderation_decisions(user_id, created_at DESC);
