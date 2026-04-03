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
    // Force gratuit limits for cancelled subscriptions (webhook delay / race condition)
    const effectivePlan: SubscriptionPlan =
      subscription.status === 'cancelled' ? 'gratuit' : subscription.plan;
    const limits = getPlanLimits(effectivePlan);
    const maxAllowed = limits[input.limitKey] as number;

    if (input.currentCount >= maxAllowed) {
      const detail: PlanLimitExceeded = {
        code: 'PLAN_LIMIT_REACHED',
        resource: input.resource,
        current: input.currentCount,
        limit: maxAllowed,
        currentPlan: effectivePlan,
        upgradePlan: UPGRADE_PATH[effectivePlan],
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
    return subscription.status === 'cancelled' ? 'gratuit' : subscription.plan;
  }

  /**
   * Ensure the household has at least the required plan level.
   * Used to gate premium features (e.g., PDF export → serenite only).
   */
  async ensurePlanFeature(input: {
    householdId: string;
    requiredPlan: SubscriptionPlan;
    feature: string;
  }): Promise<SubscriptionPlan> {
    const PLAN_LEVEL: Record<SubscriptionPlan, number> = { gratuit: 0, famille: 1, serenite: 2 };
    const currentPlan = await this.getHouseholdPlan(input.householdId);

    if (PLAN_LEVEL[currentPlan] < PLAN_LEVEL[input.requiredPlan]) {
      const detail: PlanLimitExceeded = {
        code: 'PLAN_LIMIT_REACHED',
        resource: input.feature,
        current: 0,
        limit: 0,
        currentPlan,
        upgradePlan: UPGRADE_PATH[currentPlan],
      };
      throw new ConflictError(JSON.stringify(detail));
    }

    return currentPlan;
  }
}
