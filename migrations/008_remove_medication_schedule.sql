-- Migration 008: Remove schedule column from medications
-- Purpose: Simplify medication model by using only medication_reminders table
-- The schedule field is redundant with the more flexible medication_reminders system

BEGIN;

-- Drop the schedule column
ALTER TABLE medications DROP COLUMN schedule;

COMMIT;
