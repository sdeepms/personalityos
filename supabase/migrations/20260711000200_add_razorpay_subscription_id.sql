-- Migration: Add razorpay_subscription_id to characters
-- Date: July 2026

ALTER TABLE characters
ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_characters_razorpay_sub ON characters(razorpay_subscription_id);
