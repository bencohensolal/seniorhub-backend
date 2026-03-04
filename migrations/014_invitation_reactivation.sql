-- Migration 014: Add invitation reactivation support
--
-- This migration adds support for reactivating expired invitations
-- with tracking of reactivation count and audit logging.

-- Add reactivation tracking to invitations
ALTER TABLE household_invitations
ADD COLUMN IF NOT EXISTS reactivation_count INTEGER NOT NULL DEFAULT 0;

-- Add index for efficient querying of reactivated invitations
CREATE INDEX IF NOT EXISTS idx_household_invitations_reactivation
ON household_invitations (household_id, status, reactivation_count);

-- Update audit_events constraint to include invitation_reactivated action
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_check;

ALTER TABLE audit_events ADD CONSTRAINT audit_events_action_check 
  CHECK (action IN (
    'invitation_created',
    'invitation_accepted',
    'invitation_cancelled',
    'invitation_resent',
    'invitation_reactivated'
  ));
