-- Extend audit_events to support full activity history logging
-- Previously limited to 5 invitation actions; now supports all ~78 action types.

-- 1. Drop the restrictive CHECK constraint on action
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_action_check;

-- 2. Add category column for efficient filtering
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

-- 3. Make target_id nullable (some actions have no target, e.g. login, update_settings)
ALTER TABLE audit_events ALTER COLUMN target_id DROP NOT NULL;

-- 4. Make actor_user_id nullable (system-triggered actions like webhooks, purge_expired_trash)
ALTER TABLE audit_events ALTER COLUMN actor_user_id DROP NOT NULL;

-- 5. Backfill category for existing invitation events
UPDATE audit_events SET category = 'invitations' WHERE action LIKE 'invitation_%';

-- 6. Index for filtering by category
CREATE INDEX IF NOT EXISTS idx_audit_events_household_category
ON audit_events (household_id, category, created_at DESC);
