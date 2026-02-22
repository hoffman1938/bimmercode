-- seed_data.sql - Initial data for roles, permissions, and user levels

-- ============================================================================
-- ROLES
-- ============================================================================

INSERT INTO roles (id, name, display_name, level) VALUES
('user_role', 'user', 'User', 1),
('moderator_role', 'moderator', 'Moderator', 2),
('senior_moderator_role', 'senior_moderator', 'Senior Moderator', 3),
('admin_role', 'admin', 'Administrator', 4),
('super_admin_role', 'super_admin', 'Super Administrator', 5);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Content Permissions
INSERT INTO permissions (id, name, description, category) VALUES
('perm_create_topic', 'create_topic', 'Create new topics', 'content'),
('perm_create_post', 'create_post', 'Create new posts', 'content'),
('perm_edit_own_post', 'edit_own_post', 'Edit own posts', 'content'),
('perm_delete_own_post', 'delete_own_post', 'Delete own posts', 'content'),
('perm_upload_media', 'upload_media', 'Upload images and files', 'content');

-- Moderation Permissions
INSERT INTO permissions (id, name, description, category) VALUES
('perm_edit_any_post', 'edit_any_post', 'Edit any user post', 'moderation'),
('perm_delete_any_post', 'delete_any_post', 'Delete any user post', 'moderation'),
('perm_lock_topic', 'lock_topic', 'Lock/unlock topics', 'moderation'),
('perm_pin_topic', 'pin_topic', 'Pin/unpin topics', 'moderation'),
('perm_move_topic', 'move_topic', 'Move topics between categories', 'moderation'),
('perm_archive_topic', 'archive_topic', 'Archive topics', 'moderation'),
('perm_view_reports', 'view_reports', 'View user reports', 'moderation'),
('perm_resolve_reports', 'resolve_reports', 'Resolve user reports', 'moderation'),
('perm_issue_warning', 'issue_warning', 'Issue warnings to users', 'moderation'),
('perm_temp_ban_user', 'temp_ban_user', 'Temporarily ban users', 'moderation');

-- User Management Permissions
INSERT INTO permissions (id, name, description, category) VALUES
('perm_view_user_details', 'view_user_details', 'View detailed user information', 'users'),
('perm_edit_user_profile', 'edit_user_profile', 'Edit user profiles', 'users'),
('perm_ban_user', 'ban_user', 'Permanently ban users', 'users'),
('perm_unban_user', 'unban_user', 'Unban users', 'users'),
('perm_adjust_reputation', 'adjust_reputation', 'Manually adjust user reputation', 'users'),
('perm_delete_user', 'delete_user', 'Delete user accounts', 'users');

-- Admin Permissions
INSERT INTO permissions (id, name, description, category) VALUES
('perm_assign_roles', 'assign_roles', 'Assign roles to users', 'admin'),
('perm_manage_permissions', 'manage_permissions', 'Manage role permissions', 'admin'),
('perm_view_audit_logs', 'view_audit_logs', 'View system audit logs', 'admin'),
('perm_manage_categories', 'manage_categories', 'Manage forum categories', 'admin'),
('perm_system_settings', 'system_settings', 'Modify system settings', 'admin');

-- ============================================================================
-- ROLE PERMISSIONS ASSIGNMENTS
-- ============================================================================

-- User Role (Level 1) - Basic permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
('user_role', 'perm_create_topic'),
('user_role', 'perm_create_post'),
('user_role', 'perm_edit_own_post'),
('user_role', 'perm_delete_own_post'),
('user_role', 'perm_upload_media');

-- Moderator Role (Level 2) - User permissions + moderation
INSERT INTO role_permissions (role_id, permission_id) VALUES
-- Inherit user permissions
('moderator_role', 'perm_create_topic'),
('moderator_role', 'perm_create_post'),
('moderator_role', 'perm_edit_own_post'),
('moderator_role', 'perm_delete_own_post'),
('moderator_role', 'perm_upload_media'),
-- Moderation permissions
('moderator_role', 'perm_edit_any_post'),
('moderator_role', 'perm_delete_any_post'),
('moderator_role', 'perm_lock_topic'),
('moderator_role', 'perm_pin_topic'),
('moderator_role', 'perm_move_topic'),
('moderator_role', 'perm_view_reports'),
('moderator_role', 'perm_resolve_reports'),
('moderator_role', 'perm_issue_warning'),
('moderator_role', 'perm_temp_ban_user');

-- Senior Moderator Role (Level 3) - Moderator permissions + advanced moderation
INSERT INTO role_permissions (role_id, permission_id) VALUES
-- Inherit moderator permissions
('senior_moderator_role', 'perm_create_topic'),
('senior_moderator_role', 'perm_create_post'),
('senior_moderator_role', 'perm_edit_own_post'),
('senior_moderator_role', 'perm_delete_own_post'),
('senior_moderator_role', 'perm_upload_media'),
('senior_moderator_role', 'perm_edit_any_post'),
('senior_moderator_role', 'perm_delete_any_post'),
('senior_moderator_role', 'perm_lock_topic'),
('senior_moderator_role', 'perm_pin_topic'),
('senior_moderator_role', 'perm_move_topic'),
('senior_moderator_role', 'perm_view_reports'),
('senior_moderator_role', 'perm_resolve_reports'),
('senior_moderator_role', 'perm_issue_warning'),
('senior_moderator_role', 'perm_temp_ban_user'),
-- Additional permissions
('senior_moderator_role', 'perm_archive_topic'),
('senior_moderator_role', 'perm_view_user_details'),
('senior_moderator_role', 'perm_adjust_reputation'),
('senior_moderator_role', 'perm_ban_user'),
('senior_moderator_role', 'perm_unban_user');

-- Administrator Role (Level 4) - All permissions except super admin
INSERT INTO role_permissions (role_id, permission_id) VALUES
-- Content permissions
('admin_role', 'perm_create_topic'),
('admin_role', 'perm_create_post'),
('admin_role', 'perm_edit_own_post'),
('admin_role', 'perm_delete_own_post'),
('admin_role', 'perm_upload_media'),
-- Moderation permissions
('admin_role', 'perm_edit_any_post'),
('admin_role', 'perm_delete_any_post'),
('admin_role', 'perm_lock_topic'),
('admin_role', 'perm_pin_topic'),
('admin_role', 'perm_move_topic'),
('admin_role', 'perm_archive_topic'),
('admin_role', 'perm_view_reports'),
('admin_role', 'perm_resolve_reports'),
('admin_role', 'perm_issue_warning'),
('admin_role', 'perm_temp_ban_user'),
-- User management permissions
('admin_role', 'perm_view_user_details'),
('admin_role', 'perm_edit_user_profile'),
('admin_role', 'perm_ban_user'),
('admin_role', 'perm_unban_user'),
('admin_role', 'perm_adjust_reputation'),
('admin_role', 'perm_delete_user'),
-- Admin permissions
('admin_role', 'perm_assign_roles'),
('admin_role', 'perm_view_audit_logs'),
('admin_role', 'perm_manage_categories');

-- Super Administrator Role (Level 5) - ALL permissions
INSERT INTO role_permissions (role_id, permission_id) VALUES
-- Content permissions
('super_admin_role', 'perm_create_topic'),
('super_admin_role', 'perm_create_post'),
('super_admin_role', 'perm_edit_own_post'),
('super_admin_role', 'perm_delete_own_post'),
('super_admin_role', 'perm_upload_media'),
-- Moderation permissions
('super_admin_role', 'perm_edit_any_post'),
('super_admin_role', 'perm_delete_any_post'),
('super_admin_role', 'perm_lock_topic'),
('super_admin_role', 'perm_pin_topic'),
('super_admin_role', 'perm_move_topic'),
('super_admin_role', 'perm_archive_topic'),
('super_admin_role', 'perm_view_reports'),
('super_admin_role', 'perm_resolve_reports'),
('super_admin_role', 'perm_issue_warning'),
('super_admin_role', 'perm_temp_ban_user'),
-- User management permissions
('super_admin_role', 'perm_view_user_details'),
('super_admin_role', 'perm_edit_user_profile'),
('super_admin_role', 'perm_ban_user'),
('super_admin_role', 'perm_unban_user'),
('super_admin_role', 'perm_adjust_reputation'),
('super_admin_role', 'perm_delete_user'),
-- Admin permissions
('super_admin_role', 'perm_assign_roles'),
('super_admin_role', 'perm_manage_permissions'),
('super_admin_role', 'perm_view_audit_logs'),
('super_admin_role', 'perm_manage_categories'),
('super_admin_role', 'perm_system_settings');

-- ============================================================================
-- USER LEVELS (Reputation Tiers)
-- ============================================================================

INSERT INTO user_levels (id, name, name_en, name_ru, name_ka, min_reputation, max_reputation, benefits, color) VALUES
('level_novice', 'Novice', 'Novice', 'Новичок', 'დამწყები', 0, 99, '{"max_uploads_per_day": 5, "can_vote": false}', '#9E9E9E'),
('level_member', 'Member', 'Member', 'Участник', 'წევრი', 100, 499, '{"max_uploads_per_day": 10, "can_vote": true, "can_edit_wiki": false}', '#2196F3'),
('level_expert', 'Expert', 'Expert', 'Эксперт', 'ექსპერტი', 500, 1999, '{"max_uploads_per_day": 20, "can_vote": true, "can_edit_wiki": true, "vote_weight": 2}', '#4CAF50'),
('level_guru', 'BMW Guru', 'BMW Guru', 'BMW Гуру', 'BMW გურუ', 2000, NULL, '{"max_uploads_per_day": 50, "can_vote": true, "can_edit_wiki": true, "vote_weight": 3, "can_close_topics": true}', '#FF9800');

-- ============================================================================
-- INITIAL ADMIN USER (Optional - for testing)
-- ============================================================================
-- Note: This should be removed or changed in production
-- Password: Admin123! (hashed with bcrypt cost 12)
-- Security Answer: "bmw" (hashed)

-- INSERT INTO users (
--     id, 
--     email, 
--     username, 
--     password_hash, 
--     role_id,
--     first_name,
--     security_question,
--     security_answer_hash,
--     email_verified,
--     is_active
-- ) VALUES (
--     'admin_user_id',
--     'admin@bimmercode.local',
--     'admin',
--     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eoWy.Kh8Kw8m',  -- Admin123!
--     'super_admin_role',
--     'System',
--     'first_car',
--     '$2b$12$8K1p3YE4rE4YUgZT4EmWy.oV7XJnTTIU9V5KZXpyHN8/LewY5eoWy',  -- bmw
--     1,
--     1
-- );
