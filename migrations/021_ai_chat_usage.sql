-- Daily AI assistant message counts per visitor (IP hash / identifier)
CREATE TABLE IF NOT EXISTS ai_chat_usage (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  usage_day TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_usage_identifier_day
  ON ai_chat_usage (identifier, usage_day);
