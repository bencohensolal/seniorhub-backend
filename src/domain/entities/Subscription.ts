export type SubscriptionPlan = 'gratuit' | 'famille' | 'serenite';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing';

export interface Subscription {
  id: string;
  householdId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  rcAppUserId: string | null;
  rcOriginalTransactionId: string | null;
  rcProductId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSubscriptionInput {
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  rcAppUserId?: string | null;
  rcOriginalTransactionId?: string | null;
  rcProductId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}
