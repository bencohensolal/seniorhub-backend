-- Migration 009: Add appointments and appointment_reminders tables
-- Purpose: Store household appointments with participants, location, and scheduling

BEGIN;

-- Create enum for appointment types
CREATE TYPE appointment_type AS ENUM (
  'doctor',
  'specialist',
  'dentist',
  'lab',
  'imaging',
  'therapy',
  'pharmacy',
  'hospital',
  'other'
);

-- Create enum for appointment status
CREATE TYPE appointment_status AS ENUM (
  'scheduled',
  'confirmed',
  'cancelled',
  'completed',
  'missed'
);

-- Create enum for recurrence frequency
CREATE TYPE recurrence_frequency AS ENUM (
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly'
);

-- Create appointments table
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  type appointment_type NOT NULL,
  date DATE NOT NULL,
  time VARCHAR(5) NOT NULL, -- HH:MM format
  duration INTEGER, -- minutes
  
  -- Participants (stored as JSONB arrays of UUIDs)
  senior_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of household_members.id
  caregiver_id UUID, -- Single household member ID (FK reference validated in app layer)
  
  -- Location
  address TEXT,
  location_name VARCHAR(255),
  phone_number VARCHAR(50),
  
  -- Details
  description TEXT,
  professional_name VARCHAR(255),
  preparation TEXT,
  documents_to_take TEXT,
  transport_arrangement TEXT,
  
  -- Recurrence
  recurrence JSONB, -- nullable, structure defined in app layer
  
  -- Status
  status appointment_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_time_format CHECK (time ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT valid_duration CHECK (duration IS NULL OR duration > 0),
  CONSTRAINT valid_senior_ids CHECK (jsonb_typeof(senior_ids) = 'array'),
  CONSTRAINT min_one_senior CHECK (jsonb_array_length(senior_ids) >= 1)
);

-- Create appointment_reminders table
CREATE TABLE appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  trigger_before INTEGER NOT NULL, -- minutes before appointment
  custom_message TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_trigger_before CHECK (trigger_before > 0)
);

-- Create indexes for efficient queries
CREATE INDEX idx_appointments_household_id ON appointments(household_id);
CREATE INDEX idx_appointments_date ON appointments(household_id, date);
CREATE INDEX idx_appointments_status ON appointments(household_id, status);
CREATE INDEX idx_appointments_date_status ON appointments(household_id, date, status);
CREATE INDEX idx_appointment_reminders_appointment ON appointment_reminders(appointment_id);

-- Add comments for documentation
COMMENT ON TABLE appointments IS 'Stores medical and health-related appointments for household members';
COMMENT ON COLUMN appointments.senior_ids IS 'Array of household member UUIDs (seniors) participating in this appointment';
COMMENT ON COLUMN appointments.caregiver_id IS 'Optional household member UUID (caregiver or family) assigned to this appointment';
COMMENT ON COLUMN appointments.time IS 'Appointment time in HH:MM format (24-hour)';
COMMENT ON COLUMN appointments.duration IS 'Expected appointment duration in minutes';
COMMENT ON COLUMN appointments.recurrence IS 'Optional JSON object defining recurrence pattern (frequency, interval, daysOfWeek, etc.)';
COMMENT ON TABLE appointment_reminders IS 'Stores reminder notifications for appointments';
COMMENT ON COLUMN appointment_reminders.trigger_before IS 'Number of minutes before appointment to trigger reminder';

COMMIT;
