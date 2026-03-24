-- Migration 032: Email + password authentication for non-Google users
-- Caregivers (or any household member) who don't have a Google account
-- can register with an email address and password.

CREATE TABLE email_password_accounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL UNIQUE,
  password_hash TEXT      NOT NULL,
  first_name  TEXT        NOT NULL,
  last_name   TEXT        NOT NULL,
  -- user_id follows the same pattern as proxy members: 'email_<UUID>'
  -- so it can be stored in household_members.user_id without conflict
  user_id     TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE email_auth_sessions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID        NOT NULL REFERENCES email_password_accounts(id) ON DELETE CASCADE,
  refresh_token_hash  TEXT        NOT NULL UNIQUE,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at          TIMESTAMPTZ
);

CREATE INDEX idx_email_auth_sessions_refresh_hash
  ON email_auth_sessions(refresh_token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX idx_email_auth_sessions_account
  ON email_auth_sessions(account_id);
