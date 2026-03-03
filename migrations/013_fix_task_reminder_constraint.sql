-- Migration 013: Fix task_reminders constraint to allow customMessage
-- Purpose: Allow customMessage in both reminder formats (recurring and one-time)

BEGIN;

-- Drop the old overly restrictive constraint
ALTER TABLE task_reminders
  DROP CONSTRAINT reminder_format_check;

-- Add new flexible constraint
-- Format 1 (recurring): time + days_of_week (with optional customMessage)
-- Format 2 (one-time): trigger_before (with optional customMessage)
-- At least one format must be present
ALTER TABLE task_reminders
  ADD CONSTRAINT reminder_format_check CHECK (
    (time IS NOT NULL AND days_of_week IS NOT NULL)
    OR
    (trigger_before IS NOT NULL)
  );

COMMENT ON CONSTRAINT reminder_format_check ON task_reminders IS 'Ensures reminder has either recurring format (time+daysOfWeek) OR one-time format (triggerBefore). customMessage is optional in both cases.';

COMMIT;
