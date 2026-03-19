-- Expo push tokens per user (for server-side push notifications)
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_id_idx ON user_push_tokens(user_id);

-- Dedup table: tracks which caregiver alerts have already been sent today
-- so the scheduler doesn't send the same alert multiple times
CREATE TABLE IF NOT EXISTS caregiver_medication_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  scheduled_time VARCHAR(5) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(medication_id, scheduled_date, scheduled_time)
);
