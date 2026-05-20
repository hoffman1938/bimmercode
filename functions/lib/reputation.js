// functions/lib/reputation.js - Reputation System Logic

/**
 * Calculate user level based on reputation points
 * @param {Object} env - Cloudflare environment
 * @param {number} reputation - Current reputation points
 * @param {string} lang - Language code for localized level name (en, ru, ka)
 * @returns {Promise<Object>} - User level object {id, name, color, benefits}
 */
export async function getUserLevel(env, reputation, lang = 'en') {
  let results = [];
  try {
    const levels = await env.DB.prepare(`
      SELECT * FROM user_levels
      ORDER BY min_reputation DESC
    `).all();
    results = levels.results || [];
  } catch (error) {
    console.error("getUserLevel: user_levels query failed", error);
    return null;
  }
  
  // Find first level where reputation >= min_reputation
  const level = results.find(l => reputation >= l.min_reputation) || results[results.length - 1]; // Fallback to lowest
  
  if (!level) return null;

  // Localize name
  let levelName = level.name; // Default
  if (lang === 'ru' && level.name_ru) levelName = level.name_ru;
  if (lang === 'ka' && level.name_ka) levelName = level.name_ka;
  if (lang === 'en' && level.name_en) levelName = level.name_en;

  let benefits = {};
  if (level.benefits) {
    try {
      benefits = JSON.parse(level.benefits);
    } catch {
      benefits = {};
    }
  }

  return {
    id: level.id,
    name: levelName,
    color: level.color,
    benefits,
  };
}

/**
 * Add reputation points to a user
 * @param {Object} env - Cloudflare environment
 * @param {string} userId - User to award points to
 * @param {number} amount - Amount (can be negative)
 * @param {string} reason - Reason for change
 * @param {Object} details - {entityType, entityId, moderatorId}
 */
export async function addReputation(env, userId, amount, reason, details = {}) {
  try {
    // 1. Insert history record
    const historyId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO reputation_history (id, user_id, change_amount, reason, related_entity_type, related_entity_id, moderator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      historyId, 
      userId, 
      amount, 
      reason, 
      details.entityType || null, 
      details.entityId || null, 
      details.moderatorId || null
    ).run();

    // 2. Update user total
    await env.DB.prepare(`
      UPDATE users SET reputation = reputation + ? WHERE id = ?
    `).bind(amount, userId).run();

    return true;
  } catch (error) {
    console.error('Error adding reputation:', error);
    return false;
  }
}

/**
 * Check if user can vote (rate limiting & self-voting check)
 * @param {Object} env 
 * @param {string} userId - Voter ID
 * @param {string} targetUserId - Author ID
 * @param {string} postId - Post ID
 * @returns {Promise<Object>} - {allowed: boolean, error: string}
 */
export async function canVote(env, userId, targetUserId, postId) {
  // 1. Self-voting
  if (userId === targetUserId) {
    return { allowed: false, error: "Cannot vote on your own content" };
  }

  // 2. Check User Level Permissions
  // Get user's reputation to determine level
  const user = await env.DB.prepare("SELECT reputation FROM users WHERE id = ?").bind(userId).first();
  if (!user) return { allowed: false, error: "User not found" };
  
  const level = await getUserLevel(env, user.reputation || 0);
  if (!level || !level.benefits.can_vote) {
      return { allowed: false, error: "Your reputation level does not allow voting yet" };
  }

  // 3. Already voted?
  const existing = await env.DB.prepare(`
    SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?
  `).bind(userId, postId).first();
  
  if (existing) {
    return { allowed: false, error: "Already voted" };
  }

  // 4. Daily limit (use limit from benefits if available, else default 20)
  const dailyLimit = level.benefits.max_uploads_per_day || 20; // Reusing max_uploads logic or adding vote_limit to DB schema later. 
  // For now, let's stick to hardcoded 20 or if we want strict level control we can use a new field.
  // The prompt asked for "reputation-based access control", mostly about *permission* to vote.
  // Let's keep 20 as safe default but respect 'can_vote'.

  const today = new Date().toISOString().split('T')[0];
  const count = await env.DB.prepare(`
    SELECT COUNT(*) as c FROM post_likes 
    WHERE user_id = ? AND date(created_at) = ?
  `).bind(userId, today).first('c');

  if (count >= dailyLimit) {
    return { allowed: false, error: "Daily vote limit reached" };
  }

  return { allowed: true, voteWeight: level.benefits.vote_weight || 1 };
}
