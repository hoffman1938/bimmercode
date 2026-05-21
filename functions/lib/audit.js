// functions/lib/audit.js - Audit Logging System

import { generateId } from './utils.js';

/**
 * Log an action to the audit log
 * @param {Object} env - Cloudflare environment
 * @param {Object} params - Audit log parameters
 * @param {string} params.userId - User who performed the action
 * @param {string} params.action - Action performed (e.g., 'user_banned', 'role_assigned')
 * @param {string} params.targetEntityType - Type of target entity ('user', 'post', 'topic')
 * @param {string} params.targetEntityId - ID of target entity
 * @param {string} params.targetUserId - User ID if action was on a user
 * @param {Object} params.details - Additional details (will be JSON stringified)
 * @param {string} params.ipAddress - IP address of the user
 * @param {string} params.userAgent - User agent string
 * @returns {Promise<void>}
 */
export async function logAudit(env, params) {
  const {
    userId,
    action,
    targetEntityType = null,
    targetEntityId = null,
    targetUserId = null,
    details = null,
    ipAddress = null,
    userAgent = null
  } = params;
  
  try {
    await env.DB.prepare(`
      INSERT INTO audit_logs (
        id, user_id, action, target_entity_type, target_entity_id,
        target_user_id, details, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      generateId(),
      userId,
      action,
      targetEntityType,
      targetEntityId,
      targetUserId,
      details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent
    ).run();
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't throw - audit logging shouldn't break the main operation
  }
}

/**
 * Get audit logs with filtering
 * @param {Object} env - Cloudflare environment
 * @param {Object} filters - Filter parameters
 * @param {string} filters.userId - Filter by user who performed action
 * @param {string} filters.targetUserId - Filter by target user
 * @param {string} filters.action - Filter by action type
 * @param {string} filters.dateFrom - Filter by date (ISO string)
 * @param {string} filters.dateTo - Filter by date (ISO string)
 * @param {number} filters.limit - Max results (default: 50)
 * @param {number} filters.offset - Offset for pagination (default: 0)
 * @returns {Promise<Array>} - Array of audit log entries
 */
export async function getAuditLogs(env, filters = {}) {
  const {
    userId = null,
    targetUserId = null,
    action = null,
    dateFrom = null,
    dateTo = null,
    limit = 50,
    offset = 0
  } = filters;
  
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const bindings = [];
  
  if (userId) {
    query += ' AND user_id = ?';
    bindings.push(userId);
  }
  
  if (targetUserId) {
    query += ' AND target_user_id = ?';
    bindings.push(targetUserId);
  }
  
  if (action) {
    query += ' AND action = ?';
    bindings.push(action);
  }
  
  if (dateFrom) {
    query += ' AND created_at >= ?';
    bindings.push(dateFrom);
  }
  
  if (dateTo) {
    query += ' AND created_at <= ?';
    bindings.push(dateTo);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  bindings.push(limit, offset);
  
  try {
    const result = await env.DB.prepare(query).bind(...bindings).all();
    return result.results || [];
  } catch (error) {
    console.error('Get audit logs error:', error);
    return [];
  }
}

/**
 * Get audit log count with filtering
 * @param {Object} env - Cloudflare environment
 * @param {Object} filters - Same filters as getAuditLogs
 * @returns {Promise<number>} - Total count
 */
export async function getAuditLogCount(env, filters = {}) {
  const {
    userId = null,
    targetUserId = null,
    action = null,
    dateFrom = null,
    dateTo = null
  } = filters;
  
  let query = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1';
  const bindings = [];
  
  if (userId) {
    query += ' AND user_id = ?';
    bindings.push(userId);
  }
  
  if (targetUserId) {
    query += ' AND target_user_id = ?';
    bindings.push(targetUserId);
  }
  
  if (action) {
    query += ' AND action = ?';
    bindings.push(action);
  }
  
  if (dateFrom) {
    query += ' AND created_at >= ?';
    bindings.push(dateFrom);
  }
  
  if (dateTo) {
    query += ' AND created_at <= ?';
    bindings.push(dateTo);
  }
  
  try {
    const result = await env.DB.prepare(query).bind(...bindings).first();
    return result?.count || 0;
  } catch (error) {
    console.error('Get audit log count error:', error);
    return 0;
  }
}

/**
 * Common audit actions (constants)
 */
export const AUDIT_ACTIONS = {
  // User management
  USER_REGISTERED: 'user_registered',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_BANNED: 'user_banned',
  USER_UNBANNED: 'user_unbanned',
  USER_DELETED: 'user_deleted',
  
  // Role management
  ROLE_ASSIGNED: 'role_assigned',
  ROLE_REMOVED: 'role_removed',
  
  // Content moderation
  POST_DELETED: 'post_deleted',
  POST_EDITED_BY_MOD: 'post_edited_by_moderator',
  TOPIC_LOCKED: 'topic_locked',
  TOPIC_UNLOCKED: 'topic_unlocked',
  TOPIC_PINNED: 'topic_pinned',
  TOPIC_UNPINNED: 'topic_unpinned',
  TOPIC_ARCHIVED: 'topic_archived',
  POST_PINNED: 'post_pinned',
  POST_UNPINNED: 'post_unpinned',
  
  // Warnings and reports
  WARNING_ISSUED: 'warning_issued',
  WARNING_REMOVED: 'warning_removed',
  REPORT_CREATED: 'report_created',
  REPORT_RESOLVED: 'report_resolved',
  
  // Reputation
  REPUTATION_ADJUSTED: 'reputation_adjusted',
  
  // System
  SETTINGS_CHANGED: 'settings_changed',
  PERMISSION_CHANGED: 'permission_changed'
};
