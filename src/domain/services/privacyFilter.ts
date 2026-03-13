import type { AppointmentWithReminders } from '../entities/Appointment.js';
import type { Member } from '../entities/Member.js';
import type { MedicationWithReminders } from '../entities/Medication.js';
import type { PrivacySettings } from '../entities/PrivacySettings.js';
import type { TaskWithReminders } from '../entities/Task.js';
import { ForbiddenError } from '../errors/DomainErrors.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

const DEFAULT_PRIVACY_SETTINGS: Pick<
  PrivacySettings,
  'shareProfile' | 'shareHealthData' | 'shareActivityHistory' | 'allowAnalytics'
> = {
  shareProfile: true,
  shareHealthData: true,
  shareActivityHistory: true,
  allowAnalytics: false,
};

interface HouseholdPrivacyContext {
  membersById: Map<string, Member>;
  privacyByUserId: Map<
    string,
    Pick<PrivacySettings, 'shareProfile' | 'shareHealthData' | 'shareActivityHistory' | 'allowAnalytics'>
  >;
}

const getPrivacySettings = (
  privacyByUserId: HouseholdPrivacyContext['privacyByUserId'],
  userId: string | undefined,
) => {
  if (!userId) {
    return DEFAULT_PRIVACY_SETTINGS;
  }

  return privacyByUserId.get(userId) ?? DEFAULT_PRIVACY_SETTINGS;
};

const canRequesterSeeMemberData = (
  requesterUserId: string | undefined,
  memberUserId: string | undefined,
) => requesterUserId !== undefined && memberUserId !== undefined && requesterUserId === memberUserId;

export async function buildHouseholdPrivacyContext(
  repository: HouseholdRepository,
  householdId: string,
): Promise<HouseholdPrivacyContext> {
  const members = await repository.listHouseholdMembers(householdId);
  const membersById = new Map(members.map((member) => [member.id, member]));
  const userIds = [...new Set(members.map((member) => member.userId))];
  const rawPrivacySettings = await repository.getBulkPrivacySettings(userIds);

  const privacyByUserId = new Map<
    string,
    Pick<PrivacySettings, 'shareProfile' | 'shareHealthData' | 'shareActivityHistory' | 'allowAnalytics'>
  >();

  for (const userId of userIds) {
    const settings = rawPrivacySettings.get(userId);
    privacyByUserId.set(userId, {
      shareProfile: settings?.shareProfile ?? DEFAULT_PRIVACY_SETTINGS.shareProfile,
      shareHealthData: settings?.shareHealthData ?? DEFAULT_PRIVACY_SETTINGS.shareHealthData,
      shareActivityHistory: settings?.shareActivityHistory ?? DEFAULT_PRIVACY_SETTINGS.shareActivityHistory,
      allowAnalytics: settings?.allowAnalytics ?? DEFAULT_PRIVACY_SETTINGS.allowAnalytics,
    });
  }

  return {
    membersById,
    privacyByUserId,
  };
}

export function filterMembersByPrivacy(
  members: Member[],
  context: HouseholdPrivacyContext,
  requesterUserId?: string,
): Member[] {
  return members.map((member) => {
    const settings = getPrivacySettings(context.privacyByUserId, member.userId);
    if (settings.shareProfile || canRequesterSeeMemberData(requesterUserId, member.userId)) {
      return member;
    }

    return {
      ...member,
      firstName: 'Utilisateur',
      lastName: '',
      email: 'hidden@privacy.local',
    };
  });
}

export function filterMedicationsByPrivacy(
  medications: MedicationWithReminders[],
  context: HouseholdPrivacyContext,
  requesterUserId?: string,
): MedicationWithReminders[] {
  return medications.filter((medication) => {
    const seniorMember = context.membersById.get(medication.seniorId);
    const settings = getPrivacySettings(context.privacyByUserId, seniorMember?.userId);

    return settings.shareHealthData || canRequesterSeeMemberData(requesterUserId, seniorMember?.userId);
  });
}

export function filterAppointmentsByPrivacy(
  appointments: AppointmentWithReminders[],
  context: HouseholdPrivacyContext,
  requesterUserId?: string,
): AppointmentWithReminders[] {
  return appointments.filter((appointment) =>
    appointment.seniorIds.every((seniorId) => {
      const seniorMember = context.membersById.get(seniorId);
      const settings = getPrivacySettings(context.privacyByUserId, seniorMember?.userId);

      return settings.shareHealthData || canRequesterSeeMemberData(requesterUserId, seniorMember?.userId);
    }),
  );
}

export function anonymizeTasksByPrivacy(
  tasks: TaskWithReminders[],
  context: HouseholdPrivacyContext,
  requesterUserId?: string,
): TaskWithReminders[] {
  return tasks.map((task) => {
    if (!task.completedBy) {
      return task;
    }

    const completedByMember = context.membersById.get(task.completedBy);
    const settings = getPrivacySettings(context.privacyByUserId, completedByMember?.userId);

    if (settings.shareActivityHistory || canRequesterSeeMemberData(requesterUserId, completedByMember?.userId)) {
      return task;
    }

    return {
      ...task,
      completedBy: null,
    };
  });
}

export async function assertRequesterCanShareHealthData(
  repository: HouseholdRepository,
  requesterUserId: string,
): Promise<void> {
  const settings = await repository.getUserPrivacySettings(requesterUserId);
  if ((settings?.shareHealthData ?? DEFAULT_PRIVACY_SETTINGS.shareHealthData) === false) {
    throw new ForbiddenError('Health data sharing is disabled in privacy settings.');
  }
}

export async function assertRequesterCanShareActivityHistory(
  repository: HouseholdRepository,
  requesterUserId: string,
): Promise<void> {
  const settings = await repository.getUserPrivacySettings(requesterUserId);
  if ((settings?.shareActivityHistory ?? DEFAULT_PRIVACY_SETTINGS.shareActivityHistory) === false) {
    throw new ForbiddenError('Activity history sharing is disabled in privacy settings.');
  }
}
