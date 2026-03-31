-- Migrate from Stripe to RevenueCat for subscription billing
-- Drop Stripe-specific columns and indexes, add RevenueCat columns

-- Drop Stripe indexes
DROP INDEX IF EXISTS idx_subscriptions_stripe_subscription;
DROP INDEX IF EXISTS idx_subscriptions_stripe_customer;

-- Drop Stripe columns
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_subscription_id;

-- Add RevenueCat columns
ALTER TABLE subscriptions ADD COLUMN rc_app_user_id VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN rc_original_transaction_id VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN rc_product_id VARCHAR(255);

-- Index for RevenueCat webhook lookup (app_user_id = householdId)
CREATE INDEX idx_subscriptions_rc_app_user
  ON subscriptions(rc_app_user_id)
  WHERE rc_app_user_id IS NOT NULL;

-- Update comments
COMMENT ON COLUMN subscriptions.rc_app_user_id IS 'RevenueCat app_user_id — maps to householdId';
COMMENT ON COLUMN subscriptions.rc_original_transaction_id IS 'RevenueCat original transaction ID for the purchase';
COMMENT ON COLUMN subscriptions.rc_product_id IS 'RevenueCat product identifier (e.g. famille_monthly)';
