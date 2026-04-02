-- Migration 042: Multi-senior support + confirmation feature for tasks
-- Purpose:
--   1. Convert single senior_id to JSONB senior_ids array (like journal_entries)
--   2. Add confirmation fields so caregivers can request senior confirmation

BEGIN;

-- ============================================================
-- 1. MULTI-SENIOR: senior_id → senior_ids (JSONB array)
-- ============================================================

-- Add JSONB column
ALTER TABLE tasks ADD COLUMN senior_ids JSONB;

-- Migrate existing data: convert single senior_id to array
UPDATE tasks SET senior_ids = jsonb_build_array(senior_id::text);

-- Make NOT NULL and set default
ALTER TABLE tasks ALTER COLUMN senior_ids SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN senior_ids SET DEFAULT '[]'::jsonb;

-- Add constraints
ALTER TABLE tasks ADD CONSTRAINT valid_task_senior_ids CHECK (jsonb_typeof(senior_ids) = 'array');
ALTER TABLE tasks ADD CONSTRAINT min_one_task_senior CHECK (jsonb_array_length(senior_ids) >= 1);

-- Drop old column and index
DROP INDEX IF EXISTS idx_tasks_senior_id;
ALTER TABLE tasks DROP COLUMN senior_id;

-- ============================================================
-- 2. CONFIRMATION FIELDS
-- ============================================================

-- Whether the senior must confirm task completion
ALTER TABLE tasks ADD COLUMN requires_confirmation BOOLEAN NOT NULL DEFAULT false;

-- Delay in minutes after due_time before notifying caregivers (configurable)
ALTER TABLE tasks ADD COLUMN confirmation_delay_minutes INTEGER;

-- When and by whom the task was confirmed
ALTER TABLE tasks ADD COLUMN confirmed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN confirmed_by TEXT;

-- Dedup: track when caregivers were notified about missed confirmation
ALTER TABLE tasks ADD COLUMN confirmation_notified_at TIMESTAMPTZ;

COMMIT;
