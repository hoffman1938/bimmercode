-- seed_prod.sql - Production Seed Data
-- Run this AFTER schema.sql

-- 1. Insert Roles
INSERT OR IGNORE INTO roles (id, name, display_name, level) VALUES
('user_role', 'user', 'User', 1),
('moderator_role', 'moderator', 'Moderator', 2),
('senior_moderator_role', 'senior_moderator', 'Senior Moderator', 3),
('admin_role', 'admin', 'Administrator', 4),
('super_admin_role', 'super_admin', 'Super Administrator', 5);

-- 2. Insert Permissions (Standard Set)
INSERT OR IGNORE INTO permissions (id, name, description, category) VALUES
('perm_create_topic', 'create_topic', 'Create new topics', 'content'),
('perm_create_post', 'create_post', 'Create new posts', 'content'),
('perm_edit_own_post', 'edit_own_post', 'Edit own posts', 'content'),
('perm_delete_own_post', 'delete_own_post', 'Delete own posts', 'content'),
('perm_upload_media', 'upload_media', 'Upload images and files', 'content'),
('perm_edit_any_post', 'edit_any_post', 'Edit any user post', 'moderation'),
('perm_delete_any_post', 'delete_any_post', 'Delete any user post', 'moderation'),
('perm_lock_topic', 'lock_topic', 'Lock/unlock topics', 'moderation'),
('perm_pin_topic', 'pin_topic', 'Pin/unpin topics', 'moderation'),
('perm_move_topic', 'move_topic', 'Move topics between categories', 'moderation'),
('perm_archive_topic', 'archive_topic', 'Archive topics', 'moderation'),
('perm_view_reports', 'view_reports', 'View user reports', 'moderation'),
('perm_resolve_reports', 'resolve_reports', 'Resolve user reports', 'moderation'),
('perm_issue_warning', 'issue_warning', 'Issue warnings to users', 'moderation'),
('perm_temp_ban_user', 'temp_ban_user', 'Temporarily ban users', 'moderation'),
('perm_view_user_details', 'view_user_details', 'View detailed user information', 'users'),
('perm_edit_user_profile', 'edit_user_profile', 'Edit user profiles', 'users'),
('perm_ban_user', 'ban_user', 'Permanently ban users', 'users'),
('perm_unban_user', 'unban_user', 'Unban users', 'users'),
('perm_adjust_reputation', 'adjust_reputation', 'Manually adjust user reputation', 'users'),
('perm_delete_user', 'delete_user', 'Delete user accounts', 'users'),
('perm_assign_roles', 'assign_roles', 'Assign roles to users', 'admin'),
('perm_manage_permissions', 'manage_permissions', 'Manage role permissions', 'admin'),
('perm_view_audit_logs', 'view_audit_logs', 'View system audit logs', 'admin'),
('perm_manage_categories', 'manage_categories', 'Manage forum categories', 'admin'),
('perm_system_settings', 'system_settings', 'Modify system settings', 'admin');

-- 3. Assign Permissions to Roles (Simplified for Production)
-- User
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'user_role', id FROM permissions WHERE name IN ('create_topic', 'create_post', 'edit_own_post', 'delete_own_post', 'upload_media');

-- Moderator
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'moderator_role', id FROM permissions WHERE category IN ('content', 'moderation');

-- Admin details
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) SELECT 'admin_role', id FROM permissions; -- Admin gets everything defined so far

-- 4. User Levels (Reputation)
INSERT OR IGNORE INTO user_levels (id, name, min_reputation, color) VALUES
('level_novice', 'Novice', 0, '#9E9E9E'),
('level_member', 'Member', 100, '#2196F3'),
('level_expert', 'Expert', 500, '#4CAF50'),
('level_guru', 'BMW Guru', 2000, '#FF9800');

-- 5. INITIAL SUPER ADMIN
-- Username: admin
-- Password: Sup3rPassword!
INSERT OR IGNORE INTO users (
    id, email, username, password_hash, role_id, 
    first_name, is_active, email_verified, reputation, created_at,
    security_question, security_answer_hash
) VALUES (
    'deploy_admin_001',
    'admin@example.com',
    'admin',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eoWy.Kh8Kw8m', -- Hashed 'Admin123!' (from seed_data.sql example)
    'super_admin_role',
    'System Administrator',
    1,
    1,
    99999,
    CURRENT_TIMESTAMP,
    'deployment_key',
    '$2b$12$8K1p3YE4rE4YUgZT4EmWy.oV7XJnTTIU9V5KZXpyHN8/LewY5eoWy' -- 'bmw'
);
