-- Migration: Display Tablets
-- Purpose: Add support for read-only display tablets for household monitoring
-- Security: Tokens are hashed (SHA-256) before storage, never stored in plain text

CREATE TABLE display_tablets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of the token (64 hex chars)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id),
  last_active_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked'))
);

-- Performance indexes
CREATE INDEX idx_display_tablets_household ON display_tablets(household_id);
CREATE INDEX idx_display_tablets_token_hash ON display_tablets(token_hash);
CREATE INDEX idx_display_tablets_status ON display_tablets(status);

-- Composite index for common query pattern: active tablets per household
CREATE INDEX idx_display_tablets_household_status ON display_tablets(household_id, status);

-- Comments for documentation
COMMENT ON TABLE display_tablets IS 'Read-only authentication tokens for display tablets monitoring household data';
COMMENT ON COLUMN display_tablets.token_hash IS 'SHA-256 hash of the authentication token. The plain token is NEVER stored.';
COMMENT ON COLUMN display_tablets.status IS 'Tablet status: active (can authenticate) or revoked (cannot authenticate)';
COMMENT ON COLUMN display_tablets.last_active_at IS 'Timestamp of last successful authentication, updated on each use';
