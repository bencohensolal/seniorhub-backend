-- Migration 033: Add caregiver_todos and caregiver_todo_comments tables
-- Purpose: Collaborative task management between caregivers for household/administrative tasks

BEGIN;

-- Create enum for caregiver todo status (includes 'in_progress' unlike task_status)
CREATE TYPE caregiver_todo_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled'
);

-- Create enum for caregiver todo priority (reuse same values as task_priority)
CREATE TYPE caregiver_todo_priority AS ENUM (
  'low',
  'normal',
  'high'
);

-- Create caregiver_todos table
CREATE TABLE caregiver_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,

  -- Basic information
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority caregiver_todo_priority NOT NULL DEFAULT 'normal',
  status caregiver_todo_status NOT NULL DEFAULT 'pending',

  -- Assignment
  assigned_to UUID REFERENCES household_members(id) ON DELETE SET NULL,

  -- Scheduling
  due_date DATE,

  -- Completion tracking
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES household_members(id) ON DELETE SET NULL,

  -- Follow-up / Nudge tracking
  last_nudged_at TIMESTAMPTZ,
  nudge_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES household_members(id),

  -- Constraints
  CONSTRAINT completed_has_timestamp CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR status != 'completed')
);

-- Create caregiver_todo_comments table
CREATE TABLE caregiver_todo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id UUID NOT NULL REFERENCES caregiver_todos(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES household_members(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_caregiver_todos_household ON caregiver_todos(household_id);
CREATE INDEX idx_caregiver_todos_assigned ON caregiver_todos(assigned_to);
CREATE INDEX idx_caregiver_todos_status ON caregiver_todos(household_id, status);
CREATE INDEX idx_caregiver_todos_due_date ON caregiver_todos(household_id, due_date);
CREATE INDEX idx_caregiver_todo_comments_todo ON caregiver_todo_comments(todo_id);

-- Add permission column for caregiver todos management
ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS perm_manage_caregiver_todos BOOLEAN NOT NULL DEFAULT false;

-- Set role-based defaults: caregiver and family can manage caregiver todos
UPDATE household_members SET
  perm_manage_caregiver_todos = (role IN ('caregiver', 'family'));

-- Comments
COMMENT ON TABLE caregiver_todos IS 'Collaborative tasks between caregivers for household/administrative management';
COMMENT ON TABLE caregiver_todo_comments IS 'Comments on caregiver todos for follow-up and discussion';
COMMENT ON COLUMN caregiver_todos.assigned_to IS 'Household member assigned to this todo (caregiver or family role)';
COMMENT ON COLUMN caregiver_todos.last_nudged_at IS 'When the last follow-up reminder was sent for this todo';
COMMENT ON COLUMN caregiver_todos.nudge_count IS 'Number of follow-up reminders sent for this todo';

COMMIT;
