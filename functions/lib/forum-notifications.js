// Shared: forum notification inserts + per-user mutes (topic or actor).

/**
 * @param {D1Database} db
 * @param {string} recipientUserId
 * @param {string} topicId
 * @param {string} actorUserId
 */
export async function isActivityMuted(db, recipientUserId, topicId, actorUserId) {
  if (!db || !recipientUserId) return true;
  try {
    const row = await db
      .prepare(
        `SELECT 1 AS x FROM notification_mutes
          WHERE user_id = ?
            AND (
              (scope = 'topic' AND target_id = ?)
              OR (scope = 'user' AND target_id = ?)
            )
          LIMIT 1`
      )
      .bind(String(recipientUserId), String(topicId || ""), String(actorUserId || ""))
      .first();
    return !!row;
  } catch {
    return false;
  }
}

/**
 * @param {D1Database} db
 * @param {{
 *  toUserId: string;
 *  fromUserId: string;
 *  topicId: string;
 *  type: string;
 *  title: string;
 *  text: string;
 *  link: string;
 *  icon: string;
 *  metadata?: object | string
 * }} p
 */
export async function insertNotificationIfAllowed(db, p) {
  if (!p.toUserId || !db) return;
  if (String(p.toUserId) === String(p.fromUserId)) return;
  if (await isActivityMuted(db, p.toUserId, p.topicId, p.fromUserId)) return;
  const meta =
    typeof p.metadata === "string" ? p.metadata : JSON.stringify(p.metadata || {});
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, text, link, icon, is_read, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`
    )
    .bind(
      id,
      p.toUserId,
      p.type,
      p.title,
      p.text,
      p.link,
      p.icon || "fa-bell",
      meta
    )
    .run();
}
