/**
 * FTS5 sync triggers (migration 007) write to posts_fts / topics_fts on every
 * INSERT/UPDATE/DELETE. When those virtual tables are corrupt, all forum writes fail
 * with SQLITE_CORRUPT_VTAB. Dropping the triggers restores CRUD; search falls back to LIKE.
 */

export const FTS_SYNC_TRIGGER_NAMES = [
  "posts_ai",
  "posts_ad",
  "posts_au",
  "topics_ai",
  "topics_ad",
  "topics_au",
];

export function isFtsCorruptError(err) {
  const msg = String(err?.message || err || "");
  return (
    msg.includes("SQLITE_CORRUPT") ||
    msg.includes("CORRUPT_VTAB") ||
    msg.includes("malformed")
  );
}

/** Idempotent: safe to call on every forum write. */
export async function dropFtsSyncTriggers(db) {
  for (const name of FTS_SYNC_TRIGGER_NAMES) {
    await db.prepare(`DROP TRIGGER IF EXISTS ${name}`).run();
  }
}

/**
 * Run a DB mutation; on FTS corruption, drop triggers once per isolate and retry.
 * @template T
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withFtsBypass(db, fn) {
  try {
    return await fn();
  } catch (e) {
    if (!isFtsCorruptError(e)) throw e;
    await dropFtsSyncTriggers(db);
    globalThis.__bimmerFtsTriggersDropped = true;
    return await fn();
  }
}

/** Call before forum writes (cheap no-op after triggers are gone). */
export async function ensureFtsSyncTriggersDropped(db) {
  if (globalThis.__bimmerFtsTriggersDropped) return;
  await dropFtsSyncTriggers(db);
  globalThis.__bimmerFtsTriggersDropped = true;
}
