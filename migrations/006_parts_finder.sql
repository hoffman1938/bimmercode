-- Migration: Add Parts Finder Tables
-- Version: 1.0
-- Date: 2026-02-12

-- =====================================================
-- TABLE 1: ERROR CODE PARTS
-- =====================================================
-- Maps error codes to required parts with OEM numbers
CREATE TABLE IF NOT EXISTS error_code_parts (
    id TEXT PRIMARY KEY,
    error_code TEXT NOT NULL,           -- '102613', 'P0100', etc
    part_name_en TEXT NOT NULL,         -- 'Fuel Injector'
    part_name_ru TEXT,                  -- 'Форсунка топливная'
    part_name_ka TEXT,                  -- 'საწვავის ინჟექტორი'
    part_category TEXT,                 -- 'engine', 'transmission', 'electrical', etc
    oem_number TEXT NOT NULL,           -- '13537585261'
    manufacturer TEXT,                  -- 'BMW', 'Bosch', 'Siemens', etc
    is_original BOOLEAN DEFAULT 1,      -- 1 = OEM, 0 = aftermarket
    price_min DECIMAL(10,2),            -- 180.00
    price_max DECIMAL(10,2),            -- 220.00
    currency TEXT DEFAULT 'USD',        -- 'USD', 'EUR', 'GBP'
    priority INTEGER DEFAULT 1,         -- 1 = primary part, 2 = secondary, 3 = optional
    compatibility_notes TEXT,           -- 'E90 335i (2007-2013), E60 535i'
    installation_difficulty TEXT,       -- 'easy', 'medium', 'hard', 'professional'
    estimated_labor_hours DECIMAL(3,1), -- 2.5 hours
    warranty_months INTEGER,            -- 24 months
    notes TEXT,                         -- Additional notes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_parts_error_code ON error_code_parts(error_code);
CREATE INDEX idx_parts_category ON error_code_parts(part_category);
CREATE INDEX idx_parts_oem ON error_code_parts(oem_number);
CREATE INDEX idx_parts_priority ON error_code_parts(priority);

-- =====================================================
-- TABLE 2: PART AFFILIATE LINKS
-- =====================================================
-- Stores affiliate links for each part across different marketplaces
CREATE TABLE IF NOT EXISTS part_affiliate_links (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    marketplace TEXT NOT NULL,          -- 'realoem', 'ebay', 'amazon', 'aliexpress', 'autodoc'
    region TEXT DEFAULT 'global',       -- 'US', 'EU', 'UK', 'RU', 'global'
    affiliate_url TEXT NOT NULL,
    product_title TEXT,
    current_price DECIMAL(10,2),
    original_price DECIMAL(10,2),       -- For showing discounts
    currency TEXT DEFAULT 'USD',
    in_stock BOOLEAN DEFAULT 1,
    seller_rating DECIMAL(3,2),         -- 4.85 out of 5
    shipping_cost DECIMAL(10,2),
    estimated_delivery_days INTEGER,
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_price_update TIMESTAMP,
    click_count INTEGER DEFAULT 0,      -- Track clicks for analytics
    purchase_count INTEGER DEFAULT 0,   -- Track conversions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES error_code_parts(id) ON DELETE CASCADE
);

CREATE INDEX idx_links_part_id ON part_affiliate_links(part_id);
CREATE INDEX idx_links_marketplace ON part_affiliate_links(marketplace);
CREATE INDEX idx_links_region ON part_affiliate_links(region);
CREATE INDEX idx_links_in_stock ON part_affiliate_links(in_stock);

-- =====================================================
-- TABLE 3: PART COMPATIBILITY
-- =====================================================
-- Detailed compatibility information for parts
CREATE TABLE IF NOT EXISTS part_compatibility (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    bmw_series TEXT NOT NULL,           -- 'E90', 'F30', 'G20'
    model_name TEXT,                    -- '335i', '320d', 'M3'
    year_from INTEGER,                  -- 2007
    year_to INTEGER,                    -- 2013
    engine_code TEXT,                   -- 'N54', 'N55', 'B58'
    transmission_type TEXT,             -- 'manual', 'automatic', 'both'
    market_region TEXT,                 -- 'US', 'EU', 'RoW'
    vin_pattern TEXT,                   -- For VIN-based matching
    is_compatible BOOLEAN DEFAULT 1,    -- 1 = compatible, 0 = not compatible
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES error_code_parts(id) ON DELETE CASCADE
);

CREATE INDEX idx_compat_part_id ON part_compatibility(part_id);
CREATE INDEX idx_compat_series ON part_compatibility(bmw_series);
CREATE INDEX idx_compat_engine ON part_compatibility(engine_code);

-- =====================================================
-- TABLE 4: PART REVIEWS
-- =====================================================
-- User reviews for parts
CREATE TABLE IF NOT EXISTS part_reviews (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    installation_difficulty TEXT,       -- User's experience: 'easy', 'medium', 'hard'
    would_recommend BOOLEAN DEFAULT 1,
    verified_purchase BOOLEAN DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (part_id) REFERENCES error_code_parts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_reviews_part_id ON part_reviews(part_id);
CREATE INDEX idx_reviews_user_id ON part_reviews(user_id);
CREATE INDEX idx_reviews_rating ON part_reviews(rating);

-- =====================================================
-- TABLE 5: PART PRICE HISTORY
-- =====================================================
-- Track price changes over time
CREATE TABLE IF NOT EXISTS part_price_history (
    id TEXT PRIMARY KEY,
    link_id TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    in_stock BOOLEAN DEFAULT 1,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES part_affiliate_links(id) ON DELETE CASCADE
);

CREATE INDEX idx_price_history_link_id ON part_price_history(link_id);
CREATE INDEX idx_price_history_date ON part_price_history(recorded_at);

-- =====================================================
-- TABLE 6: PART KITS
-- =====================================================
-- Pre-defined kits of parts that are commonly replaced together
CREATE TABLE IF NOT EXISTS part_kits (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ru TEXT,
    name_ka TEXT,
    description_en TEXT,
    description_ru TEXT,
    description_ka TEXT,
    error_codes TEXT,                   -- JSON array of related error codes
    total_price_min DECIMAL(10,2),
    total_price_max DECIMAL(10,2),
    savings_percent DECIMAL(5,2),       -- Discount when buying as kit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABLE 7: PART KIT ITEMS
-- =====================================================
-- Parts included in each kit
CREATE TABLE IF NOT EXISTS part_kit_items (
    id TEXT PRIMARY KEY,
    kit_id TEXT NOT NULL,
    part_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    is_optional BOOLEAN DEFAULT 0,
    FOREIGN KEY (kit_id) REFERENCES part_kits(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES error_code_parts(id) ON DELETE CASCADE
);

CREATE INDEX idx_kit_items_kit_id ON part_kit_items(kit_id);
CREATE INDEX idx_kit_items_part_id ON part_kit_items(part_id);

-- =====================================================
-- TABLE 8: USER SAVED PARTS
-- =====================================================
-- Parts saved by users for later
CREATE TABLE IF NOT EXISTS user_saved_parts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    part_id TEXT NOT NULL,
    notes TEXT,
    price_alert_enabled BOOLEAN DEFAULT 0,
    price_alert_threshold DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES error_code_parts(id) ON DELETE CASCADE,
    UNIQUE(user_id, part_id)
);

CREATE INDEX idx_saved_parts_user_id ON user_saved_parts(user_id);
CREATE INDEX idx_saved_parts_part_id ON user_saved_parts(part_id);
