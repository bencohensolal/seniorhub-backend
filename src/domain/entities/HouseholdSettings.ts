import type { HouseholdRole } from './Member.js';

export type HouseholdPermissionAction =
  | 'manageMedications'
  | 'manageAppointments'
  | 'manageTasks'
  | 'manageMembers'
  | 'viewSensitiveInfo'
  | 'viewDocuments'
  | 'manageDocuments';

export interface HouseholdMemberPermissions {
  manageMedications: boolean;
  manageAppointments: boolean;
  manageTasks: boolean;
  manageMembers: boolean;
  viewSensitiveInfo: boolean;
  viewDocuments: boolean;
  manageDocuments: boolean;
}

export interface HouseholdNotificationSettings {
  enabled: boolean;
  memberUpdates: boolean;
  invitations: boolean;
}

export interface HouseholdSettings {
  householdId: string;
  memberPermissions: Record<string, HouseholdMemberPermissions>;
  notifications: HouseholdNotificationSettings;
  seniorMenuPin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateHouseholdSettingsInput {
  memberPermissions?: Record<string, Partial<HouseholdMemberPermissions>>;
  notifications?: Partial<HouseholdNotificationSettings>;
  seniorMenuPin?: string | null;
}

export const DEFAULT_HOUSEHOLD_NOTIFICATION_SETTINGS: HouseholdNotificationSettings = {
  enabled: true,
  memberUpdates: true,
  invitations: true,
};

export const getDefaultHouseholdMemberPermissions = (
  role: HouseholdRole,
): HouseholdMemberPermissions => {
  switch (role) {
    case 'caregiver':
      return {
        manageMedications: true,
        manageAppointments: true,
        manageTasks: true,
        manageMembers: true,
        viewSensitiveInfo: true,
        viewDocuments: true,
        manageDocuments: true,
      };
    case 'family':
      return {
        manageMedications: false,
        manageAppointments: true,
        manageTasks: true,
        manageMembers: false,
        viewSensitiveInfo: false,
        viewDocuments: true,
        manageDocuments: false,
      };
    case 'intervenant':
      return {
        manageMedications: true,
        manageAppointments: true,
        manageTasks: false,
        manageMembers: false,
        viewSensitiveInfo: true,
        viewDocuments: true,
        manageDocuments: true,
      };
    case 'senior':
    default:
      return {
        manageMedications: false,
        manageAppointments: false,
        manageTasks: false,
        manageMembers: false,
        viewSensitiveInfo: true,
        viewDocuments: true,
        manageDocuments: false,
      };
  }
};
