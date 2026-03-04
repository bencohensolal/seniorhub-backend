-- Migration 015: Fix role constraints to match application roles
--
-- This migration updates the role constraints to include all valid roles:
-- 'senior', 'caregiver', 'family', and 'intervenant'

-- Update household_members role constraint
ALTER TABLE household_members DROP CONSTRAINT IF EXISTS household_members_role_check;
ALTER TABLE household_members ADD CONSTRAINT household_members_role_check 
  CHECK (role IN ('senior', 'caregiver', 'family', 'intervenant'));

-- Update household_invitations assigned_role constraint
ALTER TABLE household_invitations DROP CONSTRAINT IF EXISTS household_invitations_assigned_role_check;
ALTER TABLE household_invitations ADD CONSTRAINT household_invitations_assigned_role_check 
  CHECK (assigned_role IN ('senior', 'caregiver', 'family', 'intervenant'));
