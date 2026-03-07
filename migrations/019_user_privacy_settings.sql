-- Migration: User Privacy Settings
-- Create table to store user privacy preferences that control data sharing between household members

CREATE TABLE IF NOT EXISTS user_privacy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  share_profile BOOLEAN NOT NULL DEFAULT TRUE,
  share_health_data BOOLEAN NOT NULL DEFAULT TRUE,
  share_activity_history BOOLEAN NOT NULL DEFAULT TRUE,
  allow_analytics BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_privacy_settings_user_id UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_privacy_settings_user_id ON user_privacy_settings(user_id);

-- Insert default privacy settings for existing users
INSERT INTO user_privacy_settings (user_id, share_profile, share_health_data, share_activity_history, allow_analytics)
SELECT DISTINCT user_id, TRUE, TRUE, TRUE, FALSE
FROM household_members
WHERE user_id NOT IN (SELECT user_id FROM user_privacy_settings)
ON CONFLICT (user_id) DO NOTHING;
