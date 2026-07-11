-- Migration: Remove V1.5 Reseller Features
-- Date: July 2026

-- 1. Drop reseller-specific tables
DROP TABLE IF EXISTS character_products CASCADE;
DROP TABLE IF EXISTS character_offers CASCADE;

-- 2. Remove reseller-specific columns from characters table
ALTER TABLE characters 
DROP COLUMN IF EXISTS store_name CASCADE,
DROP COLUMN IF EXISTS product_category CASCADE;

-- 3. Remove product_image_url column from generations table
ALTER TABLE generations 
DROP COLUMN IF EXISTS product_image_url CASCADE;
