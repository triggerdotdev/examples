-- Migration: Add sources and update funding fields
-- Run this if you have an existing companies table

-- Add stage column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stage text;

-- Add sources column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sources jsonb DEFAULT '{}'::jsonb;

-- Rename amount_raised to last_round_amount
ALTER TABLE companies RENAME COLUMN amount_raised TO last_round_amount;
