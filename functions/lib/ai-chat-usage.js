// D1-backed daily AI chat usage (works without KV)

export const AI_CHAT_DAILY_MAX = 40;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function usageId(identifier, day = todayUtc()) {
  return `${identifier}:${day}`;
}

/**
 * @param {import("@cloudflare/workers-types").D1Database | null} db
 * @param {string} identifier
 */
export async function getAiChatUsage(db, identifier) {
  if (!db) {
    return { count: 0, remaining: AI_CHAT_DAILY_MAX, day: todayUtc() };
  }
  const day = todayUtc();
  try {
    const row = await db
      .prepare(
        "SELECT message_count FROM ai_chat_usage WHERE id = ? AND usage_day = ?"
      )
      .bind(usageId(identifier, day), day)
      .first();
    const count = row?.message_count ?? 0;
    return {
      count,
      remaining: Math.max(0, AI_CHAT_DAILY_MAX - count),
      day,
    };
  } catch (e) {
    console.warn("ai_chat_usage read:", e?.message || e);
    return { count: 0, remaining: AI_CHAT_DAILY_MAX, day: todayUtc() };
  }
}

/**
 * Increment usage after a successful assistant reply.
 * @returns {{ allowed: boolean, remaining: number, count: number }}
 */
export async function incrementAiChatUsage(db, identifier) {
  const usage = await getAiChatUsage(db, identifier);
  if (usage.count >= AI_CHAT_DAILY_MAX) {
    return { allowed: false, remaining: 0, count: usage.count };
  }

  if (!db) {
    const count = usage.count + 1;
    return {
      allowed: true,
      remaining: Math.max(0, AI_CHAT_DAILY_MAX - count),
      count,
    };
  }

  const day = todayUtc();
  const id = usageId(identifier, day);
  const next = usage.count + 1;

  try {
    await db
      .prepare(
        `INSERT INTO ai_chat_usage (id, identifier, usage_day, message_count, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           message_count = excluded.message_count,
           updated_at = datetime('now')`
      )
      .bind(id, identifier, day, next)
      .run();
  } catch (e) {
    console.warn("ai_chat_usage write:", e?.message || e);
    return {
      allowed: true,
      remaining: Math.max(0, AI_CHAT_DAILY_MAX - next),
      count: next,
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, AI_CHAT_DAILY_MAX - next),
    count: next,
  };
}

/**
 * Check before processing — do not increment yet.
 */
export async function checkAiChatDailyAllowance(db, identifier) {
  const usage = await getAiChatUsage(db, identifier);
  return {
    allowed: usage.count < AI_CHAT_DAILY_MAX,
    remaining: usage.remaining,
    count: usage.count,
  };
}
