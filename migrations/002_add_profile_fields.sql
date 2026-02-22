
-- Migration: Ensure Bio/Car/Avatar columns exist (Idempotent-ish)
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN car_model TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
