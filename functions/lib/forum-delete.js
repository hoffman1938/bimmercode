// functions/lib/forum-delete.js — CASCADE-safe deletes for D1/SQLite FK constraints
// (topic_tags → topics, reactions → posts, etc.)

import { ensureFtsSyncTriggersDropped, withFtsBypass } from "./fts-bypass.js";

/**
 * Remove a reply (not the opening row). Caller must enforce permissions.
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {string} postId
 */
export async function deleteSinglePost(db, postId) {
  await ensureFtsSyncTriggersDropped(db);
  return withFtsBypass(db, async () => {
  await db.prepare("DELETE FROM reactions WHERE post_id = ?").bind(postId).run();
  try {
    await db.prepare("DELETE FROM post_likes WHERE post_id = ?").bind(postId).run();
  } catch {
    /* optional table */
  }
  try {
    await db
      .prepare("DELETE FROM reports WHERE reported_entity_type = 'post' AND reported_entity_id = ?")
      .bind(postId)
      .run();
  } catch {
    /* schema variant */
  }
  try {
    await db
      .prepare("DELETE FROM moderation_decisions WHERE entity_type = 'post' AND entity_id = ?")
      .bind(postId)
      .run();
  } catch {
    /* optional */
  }
  return db.prepare("DELETE FROM posts WHERE id = ?").bind(postId).run();
  });
}

/**
 * Remove a full thread: topic_tags, mutes, reports, moderation rows, reactions, posts, topic.
 * @param {import("@cloudflare/workers-types").D1Database} db
 * @param {string} topicId
 */
export async function deleteTopicTree(db, topicId) {
  await ensureFtsSyncTriggersDropped(db);
  return withFtsBypass(db, async () => {
  try {
    await db.prepare("DELETE FROM topic_tags WHERE topic_id = ?").bind(topicId).run();
  } catch (e) {
    if (!String(e?.message || "").includes("no such table")) throw e;
  }
  try {
    await db
      .prepare("DELETE FROM notification_mutes WHERE scope = 'topic' AND target_id = ?")
      .bind(topicId)
      .run();
  } catch {
    /* table may be missing on old DBs */
  }
  try {
    await db
      .prepare("DELETE FROM reports WHERE reported_entity_type = 'topic' AND reported_entity_id = ?")
      .bind(topicId)
      .run();
    await db
      .prepare(
        `DELETE FROM reports WHERE reported_entity_type = 'post'
          AND reported_entity_id IN (SELECT id FROM posts WHERE topic_id = ?)`
      )
      .bind(topicId)
      .run();
  } catch {
    /* optional */
  }
  try {
    await db
      .prepare("DELETE FROM moderation_decisions WHERE entity_type = 'topic' AND entity_id = ?")
      .bind(topicId)
      .run();
    await db
      .prepare(
        `DELETE FROM moderation_decisions WHERE entity_type = 'post'
          AND entity_id IN (SELECT id FROM posts WHERE topic_id = ?)`
      )
      .bind(topicId)
      .run();
  } catch {
    /* optional */
  }
  await db
    .prepare("DELETE FROM reactions WHERE post_id IN (SELECT id FROM posts WHERE topic_id = ?)")
    .bind(topicId)
    .run();
  try {
    await db
      .prepare("DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE topic_id = ?)")
      .bind(topicId)
      .run();
  } catch {
    /* optional */
  }
  await db.prepare("DELETE FROM posts WHERE topic_id = ?").bind(topicId).run();
  return db.prepare("DELETE FROM topics WHERE id = ?").bind(topicId).run();
  });
}
