-- Migration 004: Add medications table
-- Purpose: Store household medications with schedule, dosage, and prescription info

BEGIN;

-- Create enum for medication forms
CREATE TYPE medication_form AS ENUM (
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'drops',
  'cream',
  'patch',
  'inhaler',
  'suppository',
  'other'
);

-- Create medications table
CREATE TABLE medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100) NOT NULL,
  form medication_form NOT NULL,
  frequency VARCHAR(255) NOT NULL,
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  prescribed_by VARCHAR(255),
  prescription_date DATE,
  start_date DATE NOT NULL,
  end_date DATE,
  instructions TEXT,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT valid_schedule CHECK (jsonb_typeof(schedule) = 'array')
);

-- Create indexes for efficient queries
CREATE INDEX idx_medications_household_id ON medications(household_id);
CREATE INDEX idx_medications_created_at ON medications(household_id, created_at DESC);
CREATE INDEX idx_medications_start_date ON medications(household_id, start_date);

-- Add comment for documentation
COMMENT ON TABLE medications IS 'Stores medications for household members with schedule and prescription information';
COMMENT ON COLUMN medications.schedule IS 'Array of time strings in HH:MM format, e.g., ["08:00", "20:00"]';
COMMENT ON COLUMN medications.frequency IS 'Human-readable frequency description, e.g., "2 times daily"';
COMMENT ON COLUMN medications.form IS 'Physical form of the medication';

COMMIT;
