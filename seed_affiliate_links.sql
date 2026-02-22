-- Affiliate Links Seed Data
-- Marketplace links for parts with affiliate URLs

-- =====================================================
-- REALOEM LINKS
-- =====================================================

-- P0100: MAF Sensor
INSERT INTO part_affiliate_links VALUES
('link_p0100_001_realoem', 'part_p0100_001', 'realoem', 'global', 'https://www.realoem.com/bmw/enUS/part?id=AFFILIATE_ID&diagId=13627566986', 'BMW MAF Sensor 13627566986', 189.99, 199.99, 'USD', 1, 4.8, 0, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0100_001_ebay', 'part_p0100_001', 'ebay', 'US', 'https://ebay.us/AFFILIATE_LINK', 'BMW OEM Mass Air Flow Sensor', 165.00, 180.00, 'USD', 1, 4.7, 15.00, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0100_001_amazon', 'part_p0100_001', 'amazon', 'US', 'https://amazon.com/dp/ASIN?tag=AFFILIATE_TAG', 'BMW Genuine MAF Sensor', 175.00, 185.00, 'USD', 1, 4.6, 0, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- Bosch MAF
INSERT INTO part_affiliate_links VALUES
('link_p0100_002_amazon', 'part_p0100_002', 'amazon', 'US', 'https://amazon.com/dp/BOSCH_ASIN?tag=AFFILIATE_TAG', 'Bosch MAF Sensor 0280218190', 95.00, 105.00, 'USD', 1, 4.5, 0, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0100_002_ebay', 'part_p0100_002', 'ebay', 'global', 'https://ebay.com/itm/AFFILIATE_LINK', 'Bosch Mass Air Flow Sensor', 89.99, 99.99, 'USD', 1, 4.6, 12.00, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0100_002_aliexpress', 'part_p0100_002', 'aliexpress', 'global', 'https://aliexpress.com/item/AFFILIATE_ID.html', 'Bosch MAF Sensor Compatible', 75.00, 85.00, 'USD', 1, 4.3, 0, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- =====================================================
-- FUEL INJECTOR LINKS (102613)
-- =====================================================

INSERT INTO part_affiliate_links VALUES
('link_102613_001_realoem', 'part_102613_001', 'realoem', 'global', 'https://www.realoem.com/bmw/enUS/part?id=AFFILIATE_ID&diagId=13537585261', 'BMW Fuel Injector 13537585261', 199.99, 219.99, 'USD', 1, 4.9, 0, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_102613_001_ebay', 'part_102613_001', 'ebay', 'US', 'https://ebay.us/AFFILIATE_LINK_INJ', 'BMW N54 N55 Fuel Injector OEM', 185.00, 195.00, 'USD', 1, 4.7, 0, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_102613_001_amazon', 'part_102613_001', 'amazon', 'US', 'https://amazon.com/dp/INJECTOR_ASIN?tag=AFFILIATE_TAG', 'BMW Genuine Fuel Injector', 189.99, 209.99, 'USD', 1, 4.8, 0, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- Bosch Injector
INSERT INTO part_affiliate_links VALUES
('link_102613_002_amazon', 'part_102613_002', 'amazon', 'US', 'https://amazon.com/dp/BOSCH_INJ?tag=AFFILIATE_TAG', 'Bosch Fuel Injector Reman', 115.00, 125.00, 'USD', 1, 4.4, 0, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_102613_002_ebay', 'part_102613_002', 'ebay', 'global', 'https://ebay.com/itm/BOSCH_INJ_LINK', 'Bosch 0280158117 Injector', 105.00, 120.00, 'USD', 1, 4.5, 8.00, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- =====================================================
-- IGNITION COILS (P0300)
-- =====================================================

INSERT INTO part_affiliate_links VALUES
('link_p0300_001_realoem', 'part_p0300_001', 'realoem', 'global', 'https://www.realoem.com/bmw/enUS/part?id=AFFILIATE_ID&diagId=12137594937', 'BMW Ignition Coil Set', 349.99, 389.99, 'USD', 1, 4.9, 0, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0300_001_amazon', 'part_p0300_001', 'amazon', 'US', 'https://amazon.com/dp/COIL_SET?tag=AFFILIATE_TAG', 'BMW OEM Ignition Coils 6pc', 329.99, 359.99, 'USD', 1, 4.7, 0, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0300_001_ebay', 'part_p0300_001', 'ebay', 'US', 'https://ebay.us/COIL_SET_LINK', 'BMW Genuine Ignition Coil Set', 315.00, 345.00, 'USD', 1, 4.8, 0, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- Single Coil
INSERT INTO part_affiliate_links VALUES
('link_p0300_002_amazon', 'part_p0300_002', 'amazon', 'US', 'https://amazon.com/dp/SINGLE_COIL?tag=AFFILIATE_TAG', 'BMW Ignition Coil Single', 59.99, 69.99, 'USD', 1, 4.6, 0, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0300_002_ebay', 'part_p0300_002', 'ebay', 'global', 'https://ebay.com/itm/SINGLE_COIL_LINK', 'BMW Ignition Coil', 52.00, 62.00, 'USD', 1, 4.7, 5.00, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- Spark Plugs
INSERT INTO part_affiliate_links VALUES
('link_p0300_003_amazon', 'part_p0300_003', 'amazon', 'US', 'https://amazon.com/dp/BMW_PLUGS?tag=AFFILIATE_TAG', 'BMW OEM Spark Plugs 6pc', 65.00, 75.00, 'USD', 1, 4.8, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0300_004_amazon', 'part_p0300_004', 'amazon', 'US', 'https://amazon.com/dp/NGK_PLUGS?tag=AFFILIATE_TAG', 'NGK PLZFR6A-11 Spark Plugs', 45.00, 52.00, 'USD', 1, 4.9, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0300_004_ebay', 'part_p0300_004', 'ebay', 'global', 'https://ebay.com/itm/NGK_PLUGS_LINK', 'NGK Spark Plugs Set of 6', 42.00, 48.00, 'USD', 1, 4.8, 3.00, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- =====================================================
-- O2 SENSORS (P0171)
-- =====================================================

INSERT INTO part_affiliate_links VALUES
('link_p0171_001_realoem', 'part_p0171_001', 'realoem', 'global', 'https://www.realoem.com/bmw/enUS/part?id=AFFILIATE_ID&diagId=11787558055', 'BMW Oxygen Sensor', 99.99, 115.00, 'USD', 1, 4.8, 0, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0171_001_amazon', 'part_p0171_001', 'amazon', 'US', 'https://amazon.com/dp/O2_SENSOR?tag=AFFILIATE_TAG', 'BMW OEM O2 Sensor Bank 1', 89.99, 109.99, 'USD', 1, 4.7, 0, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0171_002_amazon', 'part_p0171_002', 'amazon', 'US', 'https://amazon.com/dp/BOSCH_O2?tag=AFFILIATE_TAG', 'Bosch Universal O2 Sensor', 49.99, 59.99, 'USD', 1, 4.6, 0, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0171_002_ebay', 'part_p0171_002', 'ebay', 'global', 'https://ebay.com/itm/BOSCH_O2_LINK', 'Bosch Oxygen Sensor', 45.00, 55.00, 'USD', 1, 4.5, 5.00, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- =====================================================
-- CATALYTIC CONVERTER (P0420)
-- =====================================================

INSERT INTO part_affiliate_links VALUES
('link_p0420_001_realoem', 'part_p0420_001', 'realoem', 'global', 'https://www.realoem.com/bmw/enUS/part?id=AFFILIATE_ID&diagId=18307812281', 'BMW Catalytic Converter', 999.99, 1199.99, 'USD', 1, 4.9, 0, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_p0420_001_ebay', 'part_p0420_001', 'ebay', 'US', 'https://ebay.us/CAT_CONV_LINK', 'BMW OEM Catalytic Converter', 850.00, 1050.00, 'USD', 1, 4.7, 0, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- =====================================================
-- ABS PARTS (5F00)
-- =====================================================

INSERT INTO part_affiliate_links VALUES
('link_5f00_001_realoem', 'part_5f00_001', 'realoem', 'global', 'https://www.realoem.com/bmw/enUS/part?id=AFFILIATE_ID&diagId=34516791416', 'BMW ABS Pump Motor', 549.99, 599.99, 'USD', 1, 4.8, 0, 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_5f00_001_ebay', 'part_5f00_001', 'ebay', 'US', 'https://ebay.us/ABS_PUMP_LINK', 'BMW ABS Pump Motor OEM', 450.00, 550.00, 'USD', 1, 4.6, 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP),
('link_5f00_002_ebay', 'part_5f00_002', 'ebay', 'US', 'https://ebay.us/ABS_REMAN_LINK', 'BMW ABS Module Remanufactured', 275.00, 325.00, 'USD', 1, 4.5, 0, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0, CURRENT_TIMESTAMP);

-- NOTE: Replace AFFILIATE_ID, AFFILIATE_TAG, ASIN with actual affiliate credentials
-- These are placeholder links for demonstration
