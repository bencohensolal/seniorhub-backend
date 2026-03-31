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

/**
 * Returns the Stripe instance (lazy singleton).
 * Returns null if STRIPE_SECRET_KEY is not configured.
 */
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!STRIPE_SECRET_KEY) return null;
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
  return STRIPE_WEBHOOK_SECRET;
}
