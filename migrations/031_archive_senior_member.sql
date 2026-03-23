-- Migration 031: Add 'archived' status for household members
-- Allows caregivers to soft-delete/archive seniors without losing audit trail,
-- and automatically revokes their senior device access.

-- Drop the existing check constraint (auto-named by PostgreSQL)
ALTER TABLE household_members DROP CONSTRAINT IF EXISTS household_members_status_check;

-- Re-add with 'archived' included
ALTER TABLE household_members
  ADD CONSTRAINT household_members_status_check
    CHECK (status IN ('active', 'pending', 'archived'));
