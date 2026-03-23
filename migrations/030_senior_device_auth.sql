-- Migration: Senior device authentication
-- Purpose: Allow seniors without email to use the app via device pairing (like display tablets but with read+write)

-- 1. Email becomes optional in household_members
ALTER TABLE household_members ALTER COLUMN email DROP NOT NULL;

-- 2. Auth provider to distinguish Google OAuth from device-paired accounts
ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'google'
    CHECK (auth_provider IN ('google', 'device', 'phone', 'apple'));

-- 3. Optional phone number
ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS phone_number TEXT NULL;

-- 4. Senior devices table (modeled after display_tablets)
CREATE TABLE IF NOT EXISTS senior_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  token_used_at TIMESTAMPTZ,
  refresh_token_hash VARCHAR(64),
  refresh_token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT
);

CREATE INDEX idx_senior_devices_household ON senior_devices(household_id);
CREATE INDEX idx_senior_devices_member ON senior_devices(member_id);
CREATE INDEX idx_senior_devices_token_hash ON senior_devices(token_hash);
CREATE INDEX idx_senior_devices_refresh_token_hash ON senior_devices(refresh_token_hash) WHERE refresh_token_hash IS NOT NULL;
CREATE INDEX idx_senior_devices_status ON senior_devices(status);

COMMENT ON TABLE senior_devices IS 'Device-based authentication for seniors without email. Similar to display_tablets but with read+write access.';
COMMENT ON COLUMN senior_devices.token_hash IS 'SHA-256 hash of the single-use setup token returned at creation.';
COMMENT ON COLUMN senior_devices.member_id IS 'References the proxy member created for this senior in household_members.';
