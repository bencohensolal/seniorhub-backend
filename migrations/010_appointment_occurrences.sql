-- Migration 010: Appointment Occurrences for Individual Recurrence Management
-- This allows modifying/cancelling individual occurrences of recurring appointments
-- without affecting the entire series.

-- Create appointment_occurrences table
CREATE TABLE IF NOT EXISTS appointment_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  
  -- Date/time of this specific occurrence
  occurrence_date DATE NOT NULL,
  occurrence_time TIME NOT NULL,
  
  -- Status of this occurrence
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'modified', 'cancelled', 'completed', 'missed')),
  
  -- Optional overrides for this occurrence (JSONB for flexibility)
  overrides JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one occurrence per appointment per date
  UNIQUE (recurring_appointment_id, occurrence_date)
);

-- Indexes for performance
CREATE INDEX idx_appointment_occurrences_recurring_appointment ON appointment_occurrences(recurring_appointment_id);
CREATE INDEX idx_appointment_occurrences_household ON appointment_occurrences(household_id);
CREATE INDEX idx_appointment_occurrences_date ON appointment_occurrences(occurrence_date);
CREATE INDEX idx_appointment_occurrences_status ON appointment_occurrences(status);

-- Composite index for efficient queries by appointment and date range
CREATE INDEX idx_appointment_occurrences_appointment_date ON appointment_occurrences(recurring_appointment_id, occurrence_date);

-- Comments for documentation
COMMENT ON TABLE appointment_occurrences IS 'Stores modifications and cancellations of individual occurrences of recurring appointments';
COMMENT ON COLUMN appointment_occurrences.recurring_appointment_id IS 'Reference to the recurring appointment (parent)';
COMMENT ON COLUMN appointment_occurrences.occurrence_date IS 'The date of this specific occurrence';
COMMENT ON COLUMN appointment_occurrences.occurrence_time IS 'The time of this specific occurrence (may differ from parent if modified)';
COMMENT ON COLUMN appointment_occurrences.status IS 'Status: scheduled (default), modified (has overrides), cancelled, completed, missed';
COMMENT ON COLUMN appointment_occurrences.overrides IS 'JSONB object containing field overrides for this occurrence (title, location, etc.)';
