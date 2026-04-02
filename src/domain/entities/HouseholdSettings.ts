import type { HouseholdRole } from './Member.js';

export type HouseholdPermissionAction =
  // Journal / Carnet de liaison
  | 'viewJournal'
  | 'manageJournal'
  | 'deleteJournal'
  // Appointments / Agenda
  | 'viewAppointments'
  | 'manageAppointments'
  | 'deleteAppointments'
  // Tasks / Tâches
  | 'viewTasks'
  | 'manageTasks'
  | 'deleteTasks'
  // Caregiver Todos
  | 'viewCaregiverTodos'
  | 'manageCaregiverTodos'
  | 'deleteCaregiverTodos'
  // Documents
  | 'viewDocuments'
  | 'manageDocuments'
  | 'deleteDocuments'
  // Members
  | 'manageMembers'
  | 'inviteMembers'
  | 'editMemberRoles'
  | 'archiveMembers'
  | 'manageMemberPermissions'
  // Display Tablets
  | 'viewDisplayTablets'
  | 'manageDisplayTablets'
  | 'deleteDisplayTablets'
  // Sensitive info
  | 'viewSensitiveInfo';

export interface HouseholdMemberPermissions {
  viewJournal: boolean;
  manageJournal: boolean;
  deleteJournal: boolean;
  viewAppointments: boolean;
  manageAppointments: boolean;
  deleteAppointments: boolean;
  viewTasks: boolean;
  manageTasks: boolean;
  deleteTasks: boolean;
  viewCaregiverTodos: boolean;
  manageCaregiverTodos: boolean;
  deleteCaregiverTodos: boolean;
  viewDocuments: boolean;
  manageDocuments: boolean;
  deleteDocuments: boolean;
  manageMembers: boolean;
  inviteMembers: boolean;
  editMemberRoles: boolean;
  archiveMembers: boolean;
  manageMemberPermissions: boolean;
  viewDisplayTablets: boolean;
  manageDisplayTablets: boolean;
  deleteDisplayTablets: boolean;
  viewSensitiveInfo: boolean;
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
        viewJournal: true,
        manageJournal: true,
        deleteJournal: true,
        viewAppointments: true,
        manageAppointments: true,
        deleteAppointments: true,
        viewTasks: true,
        manageTasks: true,
        deleteTasks: true,
        viewCaregiverTodos: true,
        manageCaregiverTodos: true,
        deleteCaregiverTodos: true,
        viewDocuments: true,
        manageDocuments: true,
        deleteDocuments: true,
        manageMembers: true,
        inviteMembers: true,
        editMemberRoles: true,
        archiveMembers: true,
        manageMemberPermissions: true,
        viewDisplayTablets: true,
        manageDisplayTablets: true,
        deleteDisplayTablets: true,
        viewSensitiveInfo: true,
      };
    case 'family':
      return {
        viewJournal: true,
        manageJournal: false,
        deleteJournal: false,
        viewAppointments: true,
        manageAppointments: true,
        deleteAppointments: false,
        viewTasks: true,
        manageTasks: true,
        deleteTasks: false,
        viewCaregiverTodos: true,
        manageCaregiverTodos: true,
        deleteCaregiverTodos: false,
        viewDocuments: true,
        manageDocuments: false,
        deleteDocuments: false,
        manageMembers: false,
        inviteMembers: false,
        editMemberRoles: false,
        archiveMembers: false,
        manageMemberPermissions: false,
        viewDisplayTablets: true,
        manageDisplayTablets: false,
        deleteDisplayTablets: false,
        viewSensitiveInfo: false,
      };
    case 'intervenant':
      return {
        viewJournal: true,
        manageJournal: true,
        deleteJournal: false,
        viewAppointments: true,
        manageAppointments: true,
        deleteAppointments: false,
        viewTasks: true,
        manageTasks: false,
        deleteTasks: false,
        viewCaregiverTodos: true,
        manageCaregiverTodos: false,
        deleteCaregiverTodos: false,
        viewDocuments: true,
        manageDocuments: true,
        deleteDocuments: false,
        manageMembers: false,
        inviteMembers: false,
        editMemberRoles: false,
        archiveMembers: false,
        manageMemberPermissions: false,
        viewDisplayTablets: true,
        manageDisplayTablets: false,
        deleteDisplayTablets: false,
        viewSensitiveInfo: true,
      };
    case 'senior':
    default:
      return {
        viewJournal: true,
        manageJournal: false,
        deleteJournal: false,
        viewAppointments: true,
        manageAppointments: false,
        deleteAppointments: false,
        viewTasks: true,
        manageTasks: false,
        deleteTasks: false,
        viewCaregiverTodos: false,
        manageCaregiverTodos: false,
        deleteCaregiverTodos: false,
        viewDocuments: true,
        manageDocuments: false,
        deleteDocuments: false,
        manageMembers: false,
        inviteMembers: false,
        editMemberRoles: false,
        archiveMembers: false,
        manageMemberPermissions: false,
        viewDisplayTablets: false,
        manageDisplayTablets: false,
        deleteDisplayTablets: false,
        viewSensitiveInfo: true,
      };
  }
};
