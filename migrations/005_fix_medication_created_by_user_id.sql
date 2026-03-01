-- Migration 005: Fix created_by_user_id type in medications table
-- Purpose: Change from UUID to TEXT to support Google OAuth user IDs
-- Google user IDs are numeric strings like "111325199791749121741", not UUIDs

BEGIN;

-- Change created_by_user_id from UUID to TEXT
ALTER TABLE medications 
  ALTER COLUMN created_by_user_id TYPE TEXT;

-- Add comment
COMMENT ON COLUMN medications.created_by_user_id IS 'Google OAuth user ID (TEXT, not UUID)';

COMMIT;
