CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('invitation_created', 'invitation_accepted', 'invitation_cancelled')),
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_household_created_at
ON audit_events (household_id, created_at DESC);
