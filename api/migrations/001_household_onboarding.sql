CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('senior', 'caregiver')),
  status TEXT NOT NULL CHECK (status IN ('active', 'pending')),
  joined_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS household_invitations (
  id UUID PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  inviter_user_id TEXT NOT NULL,
  invitee_email TEXT NOT NULL,
  invitee_first_name TEXT NOT NULL,
  invitee_last_name TEXT NOT NULL,
  assigned_role TEXT NOT NULL CHECK (assigned_role IN ('senior', 'caregiver')),
  token_hash TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_household_invite_pending
ON household_invitations (household_id, invitee_email, assigned_role)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_household_members_household_status
ON household_members (household_id, status);

CREATE INDEX IF NOT EXISTS idx_household_invite_email_status
ON household_invitations (invitee_email, status);

CREATE INDEX IF NOT EXISTS idx_household_invite_token_expires_at
ON household_invitations (token_expires_at);
