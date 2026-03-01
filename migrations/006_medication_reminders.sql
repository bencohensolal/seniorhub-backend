-- Migration 006: Advanced medication reminders system
-- Purpose: Replace simple schedule array with flexible reminder rules
-- Allows day-of-week selection, multiple reminders per medication, enable/disable

BEGIN;

-- Create medication_reminders table
CREATE TABLE medication_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL CHECK (array_length(days_of_week, 1) > 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for efficient querying by medication
CREATE INDEX idx_medication_reminders_medication ON medication_reminders(medication_id);

-- Add comments for documentation
COMMENT ON TABLE medication_reminders IS 'Flexible medication reminder rules with day-of-week scheduling';
COMMENT ON COLUMN medication_reminders.time IS 'Time of day for reminder (HH:MM format)';
COMMENT ON COLUMN medication_reminders.days_of_week IS 'Array of day numbers: 0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN medication_reminders.enabled IS 'Whether this reminder is active';

COMMIT;
