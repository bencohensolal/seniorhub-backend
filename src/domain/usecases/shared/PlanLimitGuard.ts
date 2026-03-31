import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { SubscriptionPlan } from '../../entities/Subscription.js';
import { getPlanLimits } from '../../entities/PlanLimits.js';
import { ConflictError } from '../../errors/index.js';

export interface PlanLimitExceeded {
  code: 'PLAN_LIMIT_REACHED';
  resource: string;
  current: number;
  limit: number;
  currentPlan: SubscriptionPlan;
  upgradePlan: SubscriptionPlan | null;
}

const UPGRADE_PATH: Record<SubscriptionPlan, SubscriptionPlan | null> = {
  gratuit: 'famille',
  famille: 'serenite',
  serenite: null,
};

export class PlanLimitGuard {
  constructor(private readonly repository: HouseholdRepository) {}

  /**
   * Check if a household can create more of a given resource.
   * Throws ConflictError with plan limit details if the limit is reached.
   */
  async ensureWithinLimit(input: {
    householdId: string;
    resource: string;
    currentCount: number;
    limitKey: keyof ReturnType<typeof getPlanLimits>;
  }): Promise<void> {
    const subscription = await this.repository.ensureDefaultSubscription(input.householdId);
    const limits = getPlanLimits(subscription.plan);
    const maxAllowed = limits[input.limitKey] as number;

    if (input.currentCount >= maxAllowed) {
      const detail: PlanLimitExceeded = {
        code: 'PLAN_LIMIT_REACHED',
        resource: input.resource,
        current: input.currentCount,
        limit: maxAllowed,
        currentPlan: subscription.plan,
        upgradePlan: UPGRADE_PATH[subscription.plan],
      };

      throw new ConflictError(
        JSON.stringify(detail),
      );
    }
  }

  /**
   * Get the current plan for a household.
   */
  async getHouseholdPlan(householdId: string): Promise<SubscriptionPlan> {
    const subscription = await this.repository.ensureDefaultSubscription(householdId);
    return subscription.plan;
  }
}
