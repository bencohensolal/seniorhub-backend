import type { SubscriptionPlan } from './Subscription.js';

export interface PlanLimits {
  /** Max senior members allowed in the household */
  maxSeniors: number;
  /** Max caregiver/family/intervenant members allowed */
  maxCaregivers: number;
  maxActiveAppointments: number;
  maxActiveTasks: number;
  maxCaregiverTodos: number;
  storageQuotaBytes: number;
  maxTablets: number;
  maxPhotoScreensPerTablet: number;
  maxEmergencyContacts: number;
  historyDays: number;
}

/**
 * Parse an env var integer. Returns `Infinity` if value is -1 (unlimited sentinel).
 * Falls back to `defaultValue` if env var is unset or invalid.
 */
function envInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return defaultValue;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return defaultValue;
  return n === -1 ? Infinity : n;
}

/**
 * Parse an env var as bytes from MB.
 * e.g. PLAN_GRATUIT_STORAGE_QUOTA_MB=100 → 104857600
 */
function envMb(key: string, defaultMb: number): number {
  const mb = envInt(key, defaultMb);
  return mb === Infinity ? Infinity : mb * 1024 * 1024;
}

function buildGratuitLimits(): PlanLimits {
  return {
    maxSeniors:                envInt('PLAN_GRATUIT_MAX_SENIORS', 1),
    maxCaregivers:             envInt('PLAN_GRATUIT_MAX_CAREGIVERS', 2),

    maxActiveAppointments:     envInt('PLAN_GRATUIT_MAX_ACTIVE_APPOINTMENTS', 3),
    maxActiveTasks:            envInt('PLAN_GRATUIT_MAX_ACTIVE_TASKS', 5),
    maxCaregiverTodos:         envInt('PLAN_GRATUIT_MAX_CAREGIVER_TODOS', 5),
    storageQuotaBytes:         envMb ('PLAN_GRATUIT_STORAGE_QUOTA_MB', 100),
    maxTablets:                envInt('PLAN_GRATUIT_MAX_TABLETS', 0),
    maxPhotoScreensPerTablet:  envInt('PLAN_GRATUIT_MAX_PHOTO_SCREENS_PER_TABLET', 0),
    maxEmergencyContacts:      envInt('PLAN_GRATUIT_MAX_EMERGENCY_CONTACTS', 2),
    historyDays:               envInt('PLAN_GRATUIT_HISTORY_DAYS', 7),
  };
}

function buildFamilleLimits(): PlanLimits {
  return {
    maxSeniors:                envInt('PLAN_FAMILLE_MAX_SENIORS', 2),
    maxCaregivers:             envInt('PLAN_FAMILLE_MAX_CAREGIVERS', 4),

    maxActiveAppointments:     envInt('PLAN_FAMILLE_MAX_ACTIVE_APPOINTMENTS', 15),
    maxActiveTasks:            envInt('PLAN_FAMILLE_MAX_ACTIVE_TASKS', -1),
    maxCaregiverTodos:         envInt('PLAN_FAMILLE_MAX_CAREGIVER_TODOS', -1),
    storageQuotaBytes:         envMb ('PLAN_FAMILLE_STORAGE_QUOTA_MB', 2048),
    maxTablets:                envInt('PLAN_FAMILLE_MAX_TABLETS', 2),
    maxPhotoScreensPerTablet:  envInt('PLAN_FAMILLE_MAX_PHOTO_SCREENS_PER_TABLET', 3),
    maxEmergencyContacts:      envInt('PLAN_FAMILLE_MAX_EMERGENCY_CONTACTS', 8),
    historyDays:               envInt('PLAN_FAMILLE_HISTORY_DAYS', 90),
  };
}

function buildSereniteLimits(): PlanLimits {
  return {
    maxSeniors:                envInt('PLAN_SERENITE_MAX_SENIORS', -1),
    maxCaregivers:             envInt('PLAN_SERENITE_MAX_CAREGIVERS', -1),

    maxActiveAppointments:     envInt('PLAN_SERENITE_MAX_ACTIVE_APPOINTMENTS', -1),
    maxActiveTasks:            envInt('PLAN_SERENITE_MAX_ACTIVE_TASKS', -1),
    maxCaregiverTodos:         envInt('PLAN_SERENITE_MAX_CAREGIVER_TODOS', -1),
    storageQuotaBytes:         envMb ('PLAN_SERENITE_STORAGE_QUOTA_MB', 20480),
    maxTablets:                envInt('PLAN_SERENITE_MAX_TABLETS', 5),
    maxPhotoScreensPerTablet:  envInt('PLAN_SERENITE_MAX_PHOTO_SCREENS_PER_TABLET', 5),
    maxEmergencyContacts:      envInt('PLAN_SERENITE_MAX_EMERGENCY_CONTACTS', -1),
    historyDays:               envInt('PLAN_SERENITE_HISTORY_DAYS', -1),
  };
}

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
  switch (plan) {
    case 'gratuit':  return buildGratuitLimits();
    case 'famille':  return buildFamilleLimits();
    case 'serenite': return buildSereniteLimits();
  }
}
