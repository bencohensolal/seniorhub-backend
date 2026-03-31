-- Subscription management for household billing plans
-- Each household has exactly one active subscription (defaults to 'gratuit')

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL DEFAULT 'gratuit' CHECK (plan IN ('gratuit', 'famille', 'serenite')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each household should have at most one active subscription
CREATE UNIQUE INDEX idx_subscriptions_household_active
  ON subscriptions(household_id)
  WHERE status IN ('active', 'past_due', 'trialing');

-- Lookup by Stripe IDs for webhook processing
CREATE UNIQUE INDEX idx_subscriptions_stripe_subscription
  ON subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX idx_subscriptions_stripe_customer
  ON subscriptions(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX idx_subscriptions_household
  ON subscriptions(household_id);

-- Comments
COMMENT ON TABLE subscriptions IS 'Billing subscriptions for households. Each household has one active subscription.';
COMMENT ON COLUMN subscriptions.plan IS 'Current plan: gratuit, famille (4.99/mo), or serenite (9.99/mo)';
COMMENT ON COLUMN subscriptions.status IS 'Subscription status: active, past_due, cancelled, or trialing';
COMMENT ON COLUMN subscriptions.stripe_customer_id IS 'Stripe Customer ID for billing';
COMMENT ON COLUMN subscriptions.stripe_subscription_id IS 'Stripe Subscription ID for recurring billing';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'If true, subscription will be cancelled at the end of the current billing period';

-- Create a default gratuit subscription for every existing household
INSERT INTO subscriptions (household_id, plan, status)
SELECT id, 'gratuit', 'active'
FROM households
WHERE id NOT IN (SELECT household_id FROM subscriptions);
