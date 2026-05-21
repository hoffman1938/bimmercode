-- Admin platform extensions: dashboard metrics, restrictions, DTC, garage, marketplace, SEO

-- Contact inbox
ALTER TABLE contact_messages ADD COLUMN is_read INTEGER DEFAULT 0;

-- Category visibility flags (ignore if column exists)
ALTER TABLE categories ADD COLUMN is_hidden INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN is_private INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN is_vip INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN is_archived INTEGER DEFAULT 0;

-- User restrictions / BMW profile
ALTER TABLE users ADD COLUMN is_muted INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN shadow_banned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN restrict_uploads INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN restrict_links INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN restrict_new_topics INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN vin_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN vin TEXT;
ALTER TABLE users ADD COLUMN badges_json TEXT;

-- DTC codes (admin-managed; sync from data/codes.json on first import)
CREATE TABLE IF NOT EXISTS dtc_codes (
  code TEXT PRIMARY KEY,
  slug TEXT,
  severity TEXT DEFAULT 'medium',
  category TEXT,
  title_en TEXT,
  title_ru TEXT,
  title_ka TEXT,
  description_en TEXT,
  description_ru TEXT,
  description_ka TEXT,
  solutions_en TEXT,
  solutions_ru TEXT,
  solutions_ka TEXT,
  applicable_models TEXT,
  related_codes TEXT,
  seo_title TEXT,
  seo_description TEXT,
  media_json TEXT,
  is_published INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dtc_published ON dtc_codes(is_published);
CREATE INDEX IF NOT EXISTS idx_dtc_severity ON dtc_codes(severity);

-- Garage
CREATE TABLE IF NOT EXISTS user_vehicles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  vin TEXT,
  model TEXT,
  series TEXT,
  year INTEGER,
  engine TEXT,
  photo_url TEXT,
  description TEXT,
  mods_json TEXT,
  dyno_json TEXT,
  is_featured INTEGER DEFAULT 0,
  is_approved INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vehicles_user ON user_vehicles(user_id);

-- P2P Marketplace listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price REAL,
  currency TEXT DEFAULT 'USD',
  category TEXT,
  vin TEXT,
  photos_json TEXT,
  status TEXT DEFAULT 'pending',
  bump_count INTEGER DEFAULT 0,
  expires_at TEXT,
  seller_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_listings_status ON marketplace_listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_user ON marketplace_listings(user_id);

-- SEO
CREATE TABLE IF NOT EXISTS seo_meta (
  path TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  canonical TEXT,
  schema_json TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seo_redirects (
  id TEXT PRIMARY KEY,
  from_path TEXT NOT NULL UNIQUE,
  to_path TEXT NOT NULL,
  status_code INTEGER DEFAULT 301,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Notification templates (admin-editable)
CREATE TABLE IF NOT EXISTS notification_templates (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL UNIQUE,
  title_template TEXT,
  body_template TEXT,
  channel TEXT DEFAULT 'in_app',
  enabled INTEGER DEFAULT 1
);

-- Ad / sponsor slots
CREATE TABLE IF NOT EXISTS ad_slots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  placement TEXT NOT NULL,
  html_content TEXT,
  is_active INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Search query log (for dashboard analytics)
CREATE TABLE IF NOT EXISTS search_queries (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  path TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_search_queries_date ON search_queries(created_at DESC);

-- Extended roles
INSERT OR IGNORE INTO roles (id, name, display_name, level) VALUES
  ('verified_owner_role', 'verified_owner', 'Verified Owner', 2),
  ('bmw_technician_role', 'bmw_technician', 'BMW Technician', 3),
  ('vendor_role', 'vendor', 'Vendor / Seller', 2);

-- Permissions seed
INSERT OR IGNORE INTO permissions (id, name, description) VALUES
  ('perm_view_reports', 'view_reports', 'View moderation reports'),
  ('perm_resolve_reports', 'resolve_reports', 'Resolve reports'),
  ('perm_warn_users', 'warn_users', 'Warn users'),
  ('perm_ban_users', 'ban_users', 'Ban users'),
  ('perm_pin_content', 'pin_content', 'Pin topics and posts'),
  ('perm_manage_forum', 'manage_forum', 'Manage forum structure');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('moderator_role', 'perm_view_reports'),
  ('moderator_role', 'perm_resolve_reports'),
  ('moderator_role', 'perm_warn_users'),
  ('moderator_role', 'perm_pin_content'),
  ('senior_moderator_role', 'perm_view_reports'),
  ('senior_moderator_role', 'perm_resolve_reports'),
  ('senior_moderator_role', 'perm_warn_users'),
  ('senior_moderator_role', 'perm_ban_users'),
  ('senior_moderator_role', 'perm_pin_content'),
  ('senior_moderator_role', 'perm_manage_forum'),
  ('admin_role', 'perm_view_reports'),
  ('admin_role', 'perm_resolve_reports'),
  ('admin_role', 'perm_warn_users'),
  ('admin_role', 'perm_ban_users'),
  ('admin_role', 'perm_pin_content'),
  ('admin_role', 'perm_manage_forum'),
  ('super_admin_role', 'perm_view_reports'),
  ('super_admin_role', 'perm_resolve_reports'),
  ('super_admin_role', 'perm_warn_users'),
  ('super_admin_role', 'perm_ban_users'),
  ('super_admin_role', 'perm_pin_content'),
  ('super_admin_role', 'perm_manage_forum');

INSERT OR IGNORE INTO notification_templates (id, type, title_template, body_template, channel, enabled) VALUES
  ('tpl_welcome', 'welcome', 'Welcome to BimmerCodes', 'Your account is ready.', 'in_app', 1),
  ('tpl_report_resolved', 'report_resolved', 'Report resolved', 'Moderation action completed.', 'in_app', 1),
  ('tpl_vin_approved', 'vin_approved', 'VIN verified', 'Your VIN has been approved.', 'in_app', 1);

INSERT OR IGNORE INTO ad_slots (id, name, placement, html_content, is_active) VALUES
  ('ad_forum_sidebar', 'Forum sidebar', 'forum_sidebar', '', 0),
  ('ad_code_footer', 'Code page footer', 'code_footer', '', 0);
