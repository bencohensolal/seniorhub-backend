import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { ValidationError } from '../../errors/index.js';
import { getStripe } from '../../../config/stripe.js';

export class CreatePortalSessionUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    requesterUserId: string;
  }): Promise<{ portalUrl: string }> {
    const stripe = getStripe();
    if (!stripe) {
      throw new ValidationError('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
    }

    // Only caregivers can access the billing portal
    await this.accessValidator.ensureCaregiver(input.requesterUserId, input.householdId);

    // Get the subscription — need Stripe customer ID
    const subscription = await this.repository.ensureDefaultSubscription(input.householdId);

    if (!subscription.stripeCustomerId) {
      throw new ValidationError(
        'No billing account found for this household. Subscribe to a plan first.',
      );
    }

    // Create a Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.APP_URL ?? 'seniorhub://'}subscription`,
    });

    return { portalUrl: session.url };
  }
}
