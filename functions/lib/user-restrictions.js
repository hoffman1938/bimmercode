/** Enforce user restriction flags on forum writes */

export async function getUserRestrictions(db, userId) {
  try {
    return await db
      .prepare(
        `SELECT is_muted, shadow_banned, restrict_uploads, restrict_links,
                restrict_new_topics, is_active, role_id
         FROM users WHERE id = ?`
      )
      .bind(userId)
      .first();
  } catch {
    return null;
  }
}

export function restrictionError(flags, action) {
  if (!flags || flags.is_active === 0) return "Account is suspended";
  if (flags.is_muted) return "You are muted and cannot post";
  if (action === "new_topic" && flags.restrict_new_topics) {
    return "You cannot create new topics";
  }
  if (action === "upload" && flags.restrict_uploads) {
    return "Image uploads are restricted on your account";
  }
  return null;
}

export function stripLinksIfNeeded(content, flags) {
  if (!flags?.restrict_links || !content) return content;
  return String(content).replace(/https?:\/\/\S+/gi, "[link removed]");
}
