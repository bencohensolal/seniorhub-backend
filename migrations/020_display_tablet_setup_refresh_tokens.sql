-- Migration: Display tablet setup + refresh tokens
-- Purpose: Make QR/setup tokens single-use and introduce rotatable refresh tokens

ALTER TABLE display_tablets
  ADD COLUMN token_expires_at TIMESTAMPTZ,
  ADD COLUMN token_used_at TIMESTAMPTZ,
  ADD COLUMN refresh_token_hash VARCHAR(64),
  ADD COLUMN refresh_token_expires_at TIMESTAMPTZ;

UPDATE display_tablets
SET token_expires_at = NOW() + INTERVAL '72 hours'
WHERE status = 'active' AND token_expires_at IS NULL;

ALTER TABLE display_tablets
  ALTER COLUMN token_expires_at SET NOT NULL;

CREATE INDEX idx_display_tablets_refresh_token_hash
  ON display_tablets(refresh_token_hash)
  WHERE refresh_token_hash IS NOT NULL;

CREATE INDEX idx_display_tablets_token_expires_at
  ON display_tablets(token_expires_at);

COMMENT ON COLUMN display_tablets.token_hash IS 'SHA-256 hash of the single-use setup token returned at creation/regeneration.';
COMMENT ON COLUMN display_tablets.token_expires_at IS 'Expiration timestamp for the single-use setup token.';
COMMENT ON COLUMN display_tablets.token_used_at IS 'Timestamp of the first successful setup-token authentication.';
COMMENT ON COLUMN display_tablets.refresh_token_hash IS 'SHA-256 hash of the long-lived refresh token issued after successful setup.';
COMMENT ON COLUMN display_tablets.refresh_token_expires_at IS 'Expiration timestamp for the refresh token.';
