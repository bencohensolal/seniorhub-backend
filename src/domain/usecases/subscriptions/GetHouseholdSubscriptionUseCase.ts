import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { Subscription, SubscriptionPlan } from '../../entities/Subscription.js';
import type { PlanLimits } from '../../entities/PlanLimits.js';
import { getPlanLimits } from '../../entities/PlanLimits.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export interface HouseholdSubscriptionInfo {
  subscription: Subscription;
  limits: PlanLimits;
}

export class GetHouseholdSubscriptionUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    requesterUserId: string;
  }): Promise<HouseholdSubscriptionInfo> {
    await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    const subscription = await this.repository.ensureDefaultSubscription(input.householdId);
    // Return gratuit limits for cancelled subscriptions
    const effectivePlan: SubscriptionPlan =
      subscription.status === 'cancelled' ? 'gratuit' : subscription.plan;
    const limits = getPlanLimits(effectivePlan);

    return { subscription, limits };
  }
}
