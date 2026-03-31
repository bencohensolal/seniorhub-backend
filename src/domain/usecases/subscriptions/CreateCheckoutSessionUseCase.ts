import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { SubscriptionPlan } from '../../entities/Subscription.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { ForbiddenError, ValidationError } from '../../errors/index.js';
import { getStripe, getStripePriceIdForPlan } from '../../../config/stripe.js';

export class CreateCheckoutSessionUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    plan: 'famille' | 'serenite';
    billingPeriod: 'monthly' | 'yearly';
    requesterUserId: string;
  }): Promise<{ checkoutUrl: string }> {
    const stripe = getStripe();
    if (!stripe) {
      throw new ValidationError('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
    }

    // Only caregivers can manage subscriptions
    await this.accessValidator.ensureCaregiver(input.requesterUserId, input.householdId);

    // Get the correct price ID
    const priceId = getStripePriceIdForPlan(input.plan, input.billingPeriod);
    if (!priceId) {
      throw new ValidationError(
        `Stripe price not configured for plan "${input.plan}" with billing period "${input.billingPeriod}". ` +
        'Set the corresponding STRIPE_PRICE_* environment variable.',
      );
    }

    // Get or create Stripe customer
    const subscription = await this.repository.ensureDefaultSubscription(input.householdId);
    let customerId = subscription.stripeCustomerId;

    if (!customerId) {
      // Create a new Stripe customer linked to this household
      const customer = await stripe.customers.create({
        metadata: {
          householdId: input.householdId,
          createdBy: input.requesterUserId,
        },
      });
      customerId = customer.id;
      await this.repository.updateSubscription(subscription.id, {
        stripeCustomerId: customerId,
      });
    }

    // If household already has an active paid subscription, redirect to portal instead
    if (subscription.plan !== 'gratuit' && subscription.status === 'active' && subscription.stripeSubscriptionId) {
      throw new ValidationError(
        'This household already has an active subscription. Use the customer portal to change plans.',
      );
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        householdId: input.householdId,
        plan: input.plan,
        billingPeriod: input.billingPeriod,
      },
      subscription_data: {
        metadata: {
          householdId: input.householdId,
          plan: input.plan,
        },
      },
      // Deep link back to the app
      success_url: `${process.env.APP_URL ?? 'seniorhub://'}subscription?success=true`,
      cancel_url: `${process.env.APP_URL ?? 'seniorhub://'}subscription?cancelled=true`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new ValidationError('Failed to create checkout session — no URL returned by Stripe.');
    }

    return { checkoutUrl: session.url };
  }
}
