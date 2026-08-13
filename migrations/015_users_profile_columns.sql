-- Profile fields from schema.sql (missing on older production DBs).

ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN age INTEGER;
ALTER TABLE users ADD COLUMN city TEXT;
ALTER TABLE users ADD COLUMN country TEXT;
ALTER TABLE users ADD COLUMN bmw_year INTEGER;
ALTER TABLE users ADD COLUMN bmw_body TEXT;
ALTER TABLE users ADD COLUMN bmw_engine TEXT;
ALTER TABLE users ADD COLUMN privacy_level TEXT DEFAULT 'public';
