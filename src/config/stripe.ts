import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

/**
 * Stripe Price IDs — configure in environment variables.
 * These correspond to the products/prices created in the Stripe dashboard.
 */
const STRIPE_PRICES: Record<string, Record<string, string>> = {
  famille: {
    monthly: process.env.STRIPE_PRICE_FAMILLE_MONTHLY ?? '',
    yearly: process.env.STRIPE_PRICE_FAMILLE_YEARLY ?? '',
  },
  serenite: {
    monthly: process.env.STRIPE_PRICE_SERENITE_MONTHLY ?? '',
    yearly: process.env.STRIPE_PRICE_SERENITE_YEARLY ?? '',
  },
};

/** A key is considered "configured" only if it looks like a real Stripe key. */
function isConfigured(key: string): boolean {
  return key.startsWith('sk_test_') || key.startsWith('sk_live_');
}

/**
 * Returns the Stripe instance (lazy singleton).
 * Returns null if STRIPE_SECRET_KEY is not set or is a placeholder.
 */
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!isConfigured(STRIPE_SECRET_KEY)) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia',
      typescript: true,
    });
  }
  return stripeInstance;
}

export function getStripePriceId(plan: string, billingPeriod: string): string | null {
  return STRIPE_PRICES[plan]?.[billingPeriod] ?? null;
}

export function getStripeWebhookSecret(): string {
  return STRIPE_WEBHOOK_SECRET.startsWith('whsec_') ? STRIPE_WEBHOOK_SECRET : '';
}

export function getStripePriceIdForPlan(plan: string, billingPeriod: string): string | null {
  const id = STRIPE_PRICES[plan]?.[billingPeriod] ?? '';
  return id.startsWith('price_') ? id : null;
}
