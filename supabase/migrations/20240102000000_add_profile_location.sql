-- Migration: Add location fields to profiles table
-- Run this in Supabase Dashboard → SQL Editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS property_type TEXT DEFAULT 'residential';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coordinates JSONB;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS in_target_area BOOLEAN DEFAULT FALSE;
