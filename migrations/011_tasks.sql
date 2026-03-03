-- Migration 011: Add tasks and task_reminders tables
-- Purpose: Store daily tasks and activities for household members (hydration, exercise, social activities, etc.)

BEGIN;

-- Create enum for task categories
CREATE TYPE task_category AS ENUM (
  'hydration',
  'nutrition',
  'exercise',
  'social',
  'household',
  'wellbeing',
  'other'
);

-- Create enum for task priority
CREATE TYPE task_priority AS ENUM (
  'low',
  'normal',
  'high'
);

-- Create enum for task status
CREATE TYPE task_status AS ENUM (
  'pending',
  'completed',
  'cancelled'
);

-- Create enum for recurrence frequency (reusing similar to appointments)
-- Note: recurrence_frequency type already exists from migration 009

-- Create tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  senior_id UUID NOT NULL REFERENCES household_members(id) ON DELETE CASCADE,
  caregiver_id UUID REFERENCES household_members(id) ON DELETE SET NULL,
  
  -- Basic information
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category task_category NOT NULL,
  priority task_priority NOT NULL DEFAULT 'normal',
  status task_status NOT NULL DEFAULT 'pending',
  
  -- Scheduling
  due_date DATE,
  due_time VARCHAR(5), -- HH:MM format
  
  -- Recurrence (optional)
  recurrence JSONB, -- nullable, structure: { frequency, interval, daysOfWeek, endDate, occurrences }
  
  -- Completion tracking
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES household_members(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES household_members(id),
  
  -- Constraints
  CONSTRAINT valid_due_time_format CHECK (due_time IS NULL OR due_time ~ '^([0-1][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT completed_has_timestamp CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR status != 'completed')
);

-- Create task_reminders table
CREATE TABLE task_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Reminder schedule
  time TIME NOT NULL,
  days_of_week INTEGER[] NOT NULL CHECK (array_length(days_of_week, 1) > 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_tasks_household_id ON tasks(household_id);
CREATE INDEX idx_tasks_senior_id ON tasks(senior_id);
CREATE INDEX idx_tasks_status ON tasks(household_id, status);
CREATE INDEX idx_tasks_due_date ON tasks(household_id, due_date);
CREATE INDEX idx_tasks_category ON tasks(household_id, category);
CREATE INDEX idx_tasks_date_priority ON tasks(household_id, due_date, priority DESC);
CREATE INDEX idx_task_reminders_task ON task_reminders(task_id);
CREATE INDEX idx_task_reminders_enabled ON task_reminders(enabled);

-- Add comments for documentation
COMMENT ON TABLE tasks IS 'Stores daily tasks and activities for household seniors (non-medical reminders)';
COMMENT ON COLUMN tasks.category IS 'Type of task: hydration, nutrition, exercise, social, household, wellbeing, other';
COMMENT ON COLUMN tasks.priority IS 'Task priority level for visual emphasis: low, normal, high';
COMMENT ON COLUMN tasks.status IS 'Current task status: pending, completed, cancelled';
COMMENT ON COLUMN tasks.due_time IS 'Optional time for task in HH:MM format (24-hour)';
COMMENT ON COLUMN tasks.recurrence IS 'Optional JSON object defining recurrence pattern (frequency, interval, daysOfWeek, endDate, occurrences)';
COMMENT ON COLUMN tasks.completed_at IS 'Timestamp when task was marked as completed';
COMMENT ON COLUMN tasks.completed_by IS 'Household member who completed the task';
COMMENT ON TABLE task_reminders IS 'Stores reminder notifications for tasks with day-of-week scheduling';
COMMENT ON COLUMN task_reminders.time IS 'Time of day for reminder (HH:MM format)';
COMMENT ON COLUMN task_reminders.days_of_week IS 'Array of day numbers: 0=Sunday, 1=Monday, ..., 6=Saturday';

COMMIT;
