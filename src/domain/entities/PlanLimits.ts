import type { SubscriptionPlan } from './Subscription.js';

export interface PlanLimits {
  maxMembers: number;
  maxMedicationsPerSenior: number;
  maxActiveAppointments: number;
  maxActiveTasks: number;
  maxCaregiverTodos: number;
  storageQuotaBytes: number;
  maxTablets: number;
  maxPhotoScreensPerTablet: number;
  maxEmergencyContacts: number;
  historyDays: number;
}

const GRATUIT_LIMITS: PlanLimits = {
  maxMembers: 2,
  maxMedicationsPerSenior: 3,
  maxActiveAppointments: 3,
  maxActiveTasks: 5,
  maxCaregiverTodos: 5,
  storageQuotaBytes: 100 * 1024 * 1024, // 100 Mo
  maxTablets: 0,
  maxPhotoScreensPerTablet: 0,
  maxEmergencyContacts: 2,
  historyDays: 7,
};

const FAMILLE_LIMITS: PlanLimits = {
  maxMembers: 6,
  maxMedicationsPerSenior: 15,
  maxActiveAppointments: 15,
  maxActiveTasks: Infinity,
  maxCaregiverTodos: Infinity,
  storageQuotaBytes: 2 * 1024 * 1024 * 1024, // 2 Go
  maxTablets: 2,
  maxPhotoScreensPerTablet: 3,
  maxEmergencyContacts: 8,
  historyDays: 90,
};

const SERENITE_LIMITS: PlanLimits = {
  maxMembers: Infinity,
  maxMedicationsPerSenior: Infinity,
  maxActiveAppointments: Infinity,
  maxActiveTasks: Infinity,
  maxCaregiverTodos: Infinity,
  storageQuotaBytes: 20 * 1024 * 1024 * 1024, // 20 Go
  maxTablets: 5,
  maxPhotoScreensPerTablet: 5,
  maxEmergencyContacts: Infinity,
  historyDays: Infinity,
};

const PLAN_LIMITS_MAP: Record<SubscriptionPlan, PlanLimits> = {
  gratuit: GRATUIT_LIMITS,
  famille: FAMILLE_LIMITS,
  serenite: SERENITE_LIMITS,
};

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS_MAP[plan];
}
