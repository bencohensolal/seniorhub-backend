import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import type { AuthenticatedRequester, Household, HouseholdOverview } from '../../domain/entities/Household.js';
import type { HouseholdInvitation } from '../../domain/entities/Invitation.js';
import { getCategoryForAction } from '../../domain/entities/AuditEvent.js';
import type { AuditEvent, AuditEventInput, ListAuditEventsParams, ListAuditEventsResult } from '../../domain/entities/AuditEvent.js';
import type { HouseholdRole, Member } from '../../domain/entities/Member.js';
import { signInvitationToken, isInvitationTokenValid } from '../../domain/security/invitationToken.js';
import { buildInvitationLinks } from '../../domain/services/buildInvitationLinks.js';
import type {
  BulkInvitationResult,
  HouseholdRepository,
  InvitationCandidate,
} from '../../domain/repositories/HouseholdRepository.js';
import type { DisplayTablet } from '../../domain/entities/DisplayTablet.js';
import type { PrivacySettings } from '../../domain/entities/PrivacySettings.js';
import type { TabletDisplayConfig } from '../../domain/entities/TabletDisplayConfig.js';
import type { UserProfile } from '../../domain/entities/UserProfile.js';
import type { HouseholdSettings, UpdateHouseholdSettingsInput } from '../../domain/entities/HouseholdSettings.js';
import {
  DEFAULT_HOUSEHOLD_NOTIFICATION_SETTINGS,
  getDefaultHouseholdMemberPermissions,
} from '../../domain/entities/HouseholdSettings.js';
import type { Document, CreateDocumentInput, UpdateDocumentInput } from '../../domain/entities/Document.js';
import type { EmergencyContact, CreateEmergencyContactInput, UpdateEmergencyContactInput } from '../../domain/entities/EmergencyContact.js';
import type { DocumentFolder, DocumentFolderWithCounts, CreateDocumentFolderInput, UpdateDocumentFolderInput, DocumentFolderType, SystemRootType } from '../../domain/entities/DocumentFolder.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors/index.js';
import { nowIso, addHours, hashToken, normalizeEmail, normalizeName } from './postgres/helpers.js';

const INVITATION_TTL_HOURS = 72;

const buildDisplayName = (firstName: string, lastName: string): { firstName: string; lastName: string } => ({
  firstName: normalizeName(firstName),
  lastName: normalizeName(lastName),
});

export const DEFAULT_TEST_HOUSEHOLD_ID = '3617e173-d359-492b-94b7-4c32622e7526';

const households: Household[] = [
  {
    id: DEFAULT_TEST_HOUSEHOLD_ID,
    name: 'Famille Cohen Solal',
    createdByUserId: 'user-2',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

const members: Member[] = [
  {
    id: 'member-1',
    householdId: DEFAULT_TEST_HOUSEHOLD_ID,
    userId: 'user-1',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Martin',
    role: 'senior',
    status: 'active',
    joinedAt: nowIso(),
    createdAt: nowIso(),
    authProvider: 'google',
    phoneNumber: null,
  },
  {
    id: 'member-2',
    householdId: DEFAULT_TEST_HOUSEHOLD_ID,
    userId: 'user-2',
    email: 'ben@example.com',
    firstName: 'Ben',
    lastName: 'Martin',
    role: 'caregiver',
    status: 'active',
    joinedAt: nowIso(),
    createdAt: nowIso(),
    authProvider: 'google',
    phoneNumber: null,
  },
  {
    id: 'member-3',
    householdId: DEFAULT_TEST_HOUSEHOLD_ID,
    userId: '111325199791749121741',
    email: 'ben.cohen.solal@gmail.com',
    firstName: 'Ben',
    lastName: 'Cohen Solal',
    role: 'caregiver',
    status: 'active',
    joinedAt: nowIso(),
    createdAt: nowIso(),
    authProvider: 'google',
    phoneNumber: null,
  },
];

const invitations: HouseholdInvitation[] = [];
const auditEvents: AuditEvent[] = [];
const householdSettingsStore = new Map<string, HouseholdSettings>();
const documentFolders: DocumentFolder[] = [];
const documents: Document[] = [];

export const forceExpireInvitationForTests = (invitationId: string): void => {
  const invitation = invitations.find((item) => item.id === invitationId);
  if (!invitation) {
    return;
  }

  invitation.tokenExpiresAt = new Date(Date.now() - 1000).toISOString();
};

export class InMemoryHouseholdRepository implements HouseholdRepository {
  private buildHouseholdSettings(householdId: string, existing?: HouseholdSettings): HouseholdSettings {
    const timestamp = nowIso();
    const householdMembers = members.filter(
      (member) => member.householdId === householdId && member.status === 'active',
    );

    const memberPermissions = householdMembers.reduce<HouseholdSettings['memberPermissions']>((acc, member) => {
      acc[member.id] = getDefaultHouseholdMemberPermissions(member.role);
      return acc;
    }, {});

    return {
      householdId,
      memberPermissions,
      notifications: {
        ...DEFAULT_HOUSEHOLD_NOTIFICATION_SETTINGS,
        ...(existing?.notifications ?? {}),
      },
      seniorMenuPin: existing?.seniorMenuPin ?? null,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: existing?.updatedAt ?? timestamp,
    };
  }

  async getOverviewById(householdId: string): Promise<HouseholdOverview | null> {
    const household = households.find((item) => item.id === householdId);
    if (!household) {
      return null;
    }

    const activeMembers = members.filter(
      (member) => member.householdId === householdId && member.status === 'active',
    );

    return {
      household,
      membersCount: activeMembers.length,
      seniorsCount: activeMembers.filter((member) => member.role === 'senior').length,
      caregiversCount: activeMembers.filter((member) => member.role === 'caregiver').length,
    };
  }

  async findMemberInHousehold(memberId: string, householdId: string): Promise<Member | null> {
    return (
      members.find(
        (member) =>
          member.id === memberId && member.householdId === householdId && member.status === 'active',
      ) ?? null
    );
  }

  async findActiveMemberByUserInHousehold(userId: string, householdId: string): Promise<Member | null> {
    return (
      members.find(
        (member) =>
          member.userId === userId && member.householdId === householdId && member.status === 'active',
      ) ?? null
    );
  }

  async listUserHouseholds(userId: string): Promise<Array<{
    householdId: string;
    householdName: string;
    myRole: HouseholdRole;
    joinedAt: string;
    memberCount: number;
  }>> {
    const userMemberships = members.filter(
      (member) => member.userId === userId && member.status === 'active',
    );

    return userMemberships
      .map((membership) => {
        const household = households.find((h) => h.id === membership.householdId);
        if (!household) {
          return null;
        }

        const memberCount = members.filter(
          (m) => m.householdId === membership.householdId && m.status === 'active',
        ).length;

        return {
          householdId: household.id,
          householdName: household.name,
          myRole: membership.role,
          joinedAt: membership.joinedAt,
          memberCount,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());
  }

  async listHouseholdMembers(householdId: string): Promise<Member[]> {
    return members
      .filter((member) => member.householdId === householdId && member.status === 'active')
      .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
  }

  async createHousehold(name: string, requester: AuthenticatedRequester): Promise<Household> {
    const createdAt = nowIso();
    const household: Household = {
      id: randomUUID(),
      name: name.trim(),
      createdByUserId: requester.userId,
      createdAt,
      updatedAt: createdAt,
    };
    households.push(household);

    const display = buildDisplayName(requester.firstName, requester.lastName);

    members.push({
      id: randomUUID(),
      householdId: household.id,
      userId: requester.userId,
      email: normalizeEmail(requester.email),
      firstName: display.firstName,
      lastName: display.lastName,
      role: 'caregiver',
      status: 'active',
      joinedAt: createdAt,
      createdAt,
      authProvider: 'google',
      phoneNumber: null,
    });

    householdSettingsStore.set(
      household.id,
      this.buildHouseholdSettings(household.id),
    );

    return household;
  }

  async createBulkInvitations(input: {
    householdId: string;
    inviterUserId: string;
    users: InvitationCandidate[];
  }): Promise<BulkInvitationResult> {
    const result: BulkInvitationResult = {
      acceptedCount: 0,
      skippedDuplicates: 0,
      perUserErrors: [],
      deliveries: [],
    };

    for (const user of input.users) {
      const email = normalizeEmail(user.email);

      const duplicate = invitations.some(
        (invitation) =>
          invitation.householdId === input.householdId &&
          invitation.inviteeEmail === email &&
          invitation.assignedRole === user.role &&
          invitation.status === 'pending',
      );

      if (duplicate) {
        result.skippedDuplicates += 1;
        continue;
      }

      const activeMember = members.find(
        (member) =>
          member.householdId === input.householdId &&
          member.email !== null && normalizeEmail(member.email) === email &&
          member.status === 'active',
      );

      if (activeMember) {
        result.perUserErrors.push({
          email,
          reason: 'Invitation cannot be created for this recipient.',
        });
        continue;
      }

      const household = households.find((h) => h.id === input.householdId);
      if (!household) {
        result.perUserErrors.push({
          email,
          reason: 'Household not found.',
        });
        continue;
      }

      const createdAt = nowIso();
      const invitationId = randomUUID();
      const token = signInvitationToken(invitationId, env.TOKEN_SIGNING_SECRET);
      const invitation: HouseholdInvitation = {
        id: invitationId,
        householdId: input.householdId,
        householdName: household.name,
        inviterUserId: input.inviterUserId,
        inviteeEmail: email,
        inviteeFirstName: user.firstName.trim(),
        inviteeLastName: user.lastName.trim(),
        assignedRole: user.role,
        tokenHash: hashToken(token),
        tokenExpiresAt: addHours(createdAt, INVITATION_TTL_HOURS),
        status: 'pending',
        reactivationCount: 0,
        createdAt,
        acceptedAt: null,
      };

      invitations.push(invitation);
      result.acceptedCount += 1;

      const links = buildInvitationLinks({
        token,
        backendBaseUrl: env.BACKEND_URL,
        ...(env.INVITATION_WEB_FALLBACK_URL
          ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL }
          : {}),
      });

      result.deliveries.push({
        invitationId: invitation.id,
        inviteeEmail: email,
        status: 'sent',
        acceptLinkUrl: links.acceptLinkUrl,
        deepLinkUrl: links.deepLinkUrl,
        fallbackUrl: links.fallbackUrl,
        reason: null,
      });
    }

    return result;
  }

  async listPendingInvitationsByEmail(email: string): Promise<HouseholdInvitation[]> {
    const normalized = normalizeEmail(email);
    const now = new Date();

    return invitations
      .filter((invitation) => {
        if (invitation.inviteeEmail !== normalized || invitation.status !== 'pending') {
          return false;
        }

        if (new Date(invitation.tokenExpiresAt) <= now) {
          invitation.status = 'expired';
          return false;
        }

        return true;
      })
      .map((invitation) => ({ ...invitation }));
  }

  async listHouseholdInvitations(householdId: string): Promise<HouseholdInvitation[]> {
    const now = new Date();

    // Expire old invitations
    invitations.forEach((invitation) => {
      if (
        invitation.householdId === householdId &&
        invitation.status === 'pending' &&
        new Date(invitation.tokenExpiresAt) <= now
      ) {
        invitation.status = 'expired';
      }
    });

    // Return all invitations for the household
    return invitations
      .filter((invitation) => invitation.householdId === householdId)
      .map((invitation) => ({ ...invitation }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async resolveInvitationByToken(token: string): Promise<HouseholdInvitation | null> {
    if (!isInvitationTokenValid(token, env.TOKEN_SIGNING_SECRET)) {
      return null;
    }

    const tokenHash = hashToken(token);
    const invitation = invitations.find((item) => item.tokenHash === tokenHash);

    if (!invitation) {
      return null;
    }

    if (invitation.status !== 'pending') {
      return null;
    }

    if (new Date(invitation.tokenExpiresAt) <= new Date()) {
      invitation.status = 'expired';
      return null;
    }

    return { ...invitation };
  }

  async acceptInvitation(input: {
    requester: AuthenticatedRequester;
    token?: string;
    invitationId?: string;
  }): Promise<{ householdId: string; role: HouseholdRole }> {
    const email = normalizeEmail(input.requester.email);

    let invitation: HouseholdInvitation | undefined;

    if (input.token) {
      if (!isInvitationTokenValid(input.token, env.TOKEN_SIGNING_SECRET)) {
        throw new NotFoundError('Invitation not found.');
      }

      const tokenHash = hashToken(input.token);
      invitation = invitations.find((item) => item.tokenHash === tokenHash);
    } else if (input.invitationId) {
      invitation = invitations.find((item) => item.id === input.invitationId);
    } else {
      invitation = invitations.find(
        (item) => item.inviteeEmail === email && item.status === 'pending',
      );
    }

    if (!invitation) {
      throw new NotFoundError('Invitation not found.');
    }

    if (invitation.inviteeEmail !== email) {
      throw new ForbiddenError('Access denied to this invitation.');
    }

    if (invitation.status !== 'pending') {
      throw new ConflictError('Invitation is not pending.');
    }

    if (new Date(invitation.tokenExpiresAt) <= new Date()) {
      invitation.status = 'expired';
      throw new ConflictError('Invitation expired. Please request a new invitation.');
    }

    invitation.status = 'accepted';
    invitation.acceptedAt = nowIso();

    const existingMember = members.find(
      (member) => member.userId === input.requester.userId && member.householdId === invitation.householdId,
    );

    if (existingMember) {
      existingMember.status = 'active';
      existingMember.role = invitation.assignedRole;
      existingMember.joinedAt = nowIso();
    } else {
      const display = buildDisplayName(input.requester.firstName, input.requester.lastName);
      members.push({
        id: randomUUID(),
        householdId: invitation.householdId,
        userId: input.requester.userId,
        email,
        firstName: display.firstName,
        lastName: display.lastName,
        role: invitation.assignedRole,
        status: 'active',
        joinedAt: nowIso(),
        createdAt: nowIso(),
        authProvider: 'google',
        phoneNumber: null,
      });
    }

    return {
      householdId: invitation.householdId,
      role: invitation.assignedRole,
    };
  }

  async cancelInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<void> {
    const requester = await this.findActiveMemberByUserInHousehold(input.requesterUserId, input.householdId);
    if (!requester || requester.role !== 'caregiver') {
      throw new Error('Only caregivers can cancel invitations.');
    }

    const invitation = invitations.find(
      (item) => item.id === input.invitationId && item.householdId === input.householdId,
    );

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is not pending.');
    }

    invitation.status = 'cancelled';
  }

  async resendInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<{ newToken: string; newExpiresAt: string; acceptLinkUrl: string; deepLinkUrl: string; fallbackUrl: string | null }> {
    const requester = await this.findActiveMemberByUserInHousehold(input.requesterUserId, input.householdId);
    if (!requester || requester.role !== 'caregiver') {
      throw new Error('Only caregivers can resend invitations.');
    }

    const invitation = invitations.find(
      (item) => item.id === input.invitationId && item.householdId === input.householdId,
    );

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Can only resend pending invitations.');
    }

    if (new Date(invitation.tokenExpiresAt) <= new Date()) {
      throw new Error('Cannot resend expired invitation. Please cancel and create a new one.');
    }

    const newExpiresAt = addHours(nowIso(), INVITATION_TTL_HOURS);
    const newToken = signInvitationToken(input.invitationId, env.TOKEN_SIGNING_SECRET);
    const newTokenHash = hashToken(newToken);

    invitation.tokenHash = newTokenHash;
    invitation.tokenExpiresAt = newExpiresAt;

    const links = buildInvitationLinks({
      token: newToken,
      backendBaseUrl: env.BACKEND_URL,
      ...(env.INVITATION_WEB_FALLBACK_URL ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL } : {}),
    });

    return {
      newToken,
      newExpiresAt,
      acceptLinkUrl: links.acceptLinkUrl,
      deepLinkUrl: links.deepLinkUrl,
      fallbackUrl: links.fallbackUrl,
    };
  }

  async reactivateInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<{
    id: string;
    inviteeFirstName: string;
    inviteeLastName: string;
    inviteeEmail: string;
    assignedRole: HouseholdRole;
    newToken: string;
    newExpiresAt: string;
    acceptLinkUrl: string;
    deepLinkUrl: string;
    fallbackUrl: string | null;
  }> {
    const requester = await this.findActiveMemberByUserInHousehold(input.requesterUserId, input.householdId);
    if (!requester || requester.role !== 'caregiver') {
      throw new Error('Only caregivers can reactivate invitations.');
    }

    const invitation = invitations.find(
      (item) => item.id === input.invitationId && item.householdId === input.householdId,
    );

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.status !== 'expired') {
      throw new Error('Can only reactivate expired invitations.');
    }

    const newExpiresAt = addHours(nowIso(), INVITATION_TTL_HOURS);
    const newToken = signInvitationToken(input.invitationId, env.TOKEN_SIGNING_SECRET);
    const newTokenHash = hashToken(newToken);

    invitation.tokenHash = newTokenHash;
    invitation.tokenExpiresAt = newExpiresAt;
    invitation.status = 'pending';
    invitation.reactivationCount += 1;

    const links = buildInvitationLinks({
      token: newToken,
      backendBaseUrl: env.BACKEND_URL,
      ...(env.INVITATION_WEB_FALLBACK_URL ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL } : {}),
    });

    return {
      id: invitation.id,
      inviteeFirstName: invitation.inviteeFirstName,
      inviteeLastName: invitation.inviteeLastName,
      inviteeEmail: invitation.inviteeEmail,
      assignedRole: invitation.assignedRole,
      newToken,
      newExpiresAt,
      acceptLinkUrl: links.acceptLinkUrl,
      deepLinkUrl: links.deepLinkUrl,
      fallbackUrl: links.fallbackUrl,
    };
  }

  async logAuditEvent(input: AuditEventInput): Promise<void> {
    auditEvents.push({
      id: randomUUID(),
      householdId: input.householdId ?? '',
      actorUserId: input.actorUserId ?? null,
      actorFirstName: null,
      actorLastName: null,
      action: input.action,
      category: input.category ?? getCategoryForAction(input.action),
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      createdAt: nowIso(),
    });
  }

  async listAuditEvents(params: ListAuditEventsParams): Promise<ListAuditEventsResult> {
    let filtered = auditEvents.filter((e) => e.householdId === params.householdId);
    if (params.category) filtered = filtered.filter((e) => e.category === params.category);
    if (params.sinceDate) filtered = filtered.filter((e) => e.createdAt >= params.sinceDate!);
    if (params.cursor) filtered = filtered.filter((e) => e.createdAt < params.cursor!);
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const limit = params.limit || 50;
    const events = filtered.slice(0, limit);
    return {
      events,
      nextCursor: filtered.length > limit ? events[events.length - 1].createdAt : null,
    };
  }

  async findMemberById(memberId: string): Promise<Member | null> {
    const member = members.find((m) => m.id === memberId && m.status === 'active');
    return member ?? null;
  }

  async removeMember(memberId: string): Promise<void> {
    const index = members.findIndex((m) => m.id === memberId);
    if (index !== -1) {
      members.splice(index, 1);
    }
  }

  async updateMemberRole(memberId: string, newRole: HouseholdRole): Promise<Member> {
    const member = members.find((m) => m.id === memberId && m.status === 'active');
    if (!member) {
      throw new Error('Member not found or already removed.');
    }
    member.role = newRole;
    return member;
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const member = members.find((item) => item.userId === userId && item.status === 'active');
    if (!member) {
      return null;
    }

    return {
      userId: member.userId,
      email: member.email ?? '',
      firstName: member.firstName,
      lastName: member.lastName,
      updatedAt: member.joinedAt,
    };
  }

  async updateUserProfile(userId: string, input: { email: string; firstName: string; lastName: string }): Promise<UserProfile> {
    const normalizedFirstName = normalizeName(input.firstName);
    const normalizedLastName = normalizeName(input.lastName);
    const normalizedEmail = normalizeEmail(input.email);
    const activeMembers = members.filter((member) => member.userId === userId && member.status === 'active');

    if (activeMembers.length === 0) {
      throw new NotFoundError('No active household membership found for this user.');
    }

    activeMembers.forEach((member) => {
      member.firstName = normalizedFirstName;
      member.lastName = normalizedLastName;
      member.email = normalizedEmail;
    });

    const latestMember = activeMembers[0];
    if (!latestMember) {
      throw new NotFoundError('No active household membership found for this user.');
    }

    return {
      userId,
      email: normalizedEmail,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      updatedAt: latestMember.joinedAt,
    };
  }


  // Appointment methods - stub implementations for test compatibility
  async listHouseholdAppointments(_householdId: string): Promise<never[]> {
    return [];
  }

  async getAppointmentById(_appointmentId: string, _householdId: string): Promise<null> {
    return null;
  }

  async createAppointment(_input: unknown): Promise<never> {
    throw new Error('Appointment operations not implemented in InMemoryRepository');
  }

  async updateAppointment(_appointmentId: string, _householdId: string, _input: unknown): Promise<never> {
    throw new Error('Appointment operations not implemented in InMemoryRepository');
  }

  async deleteAppointment(_appointmentId: string, _householdId: string): Promise<void> {
    throw new Error('Appointment operations not implemented in InMemoryRepository');
  }

  // Appointment Reminder methods - stub implementations for test compatibility
  async listAppointmentReminders(_appointmentId: string, _householdId: string): Promise<never[]> {
    return [];
  }

  async getAppointmentReminderById(_reminderId: string, _appointmentId: string, _householdId: string): Promise<null> {
    return null;
  }

  async createAppointmentReminder(_input: unknown): Promise<never> {
    throw new Error('Appointment reminder operations not implemented in InMemoryRepository');
  }

  async updateAppointmentReminder(_reminderId: string, _appointmentId: string, _householdId: string, _input: unknown): Promise<never> {
    throw new Error('Appointment reminder operations not implemented in InMemoryRepository');
  }

  async deleteAppointmentReminder(_reminderId: string, _appointmentId: string, _householdId: string): Promise<void> {
    throw new Error('Appointment reminder operations not implemented in InMemoryRepository');
  }

  // Appointment Occurrence methods - stub implementations for test compatibility
  async getOccurrenceById(_occurrenceId: string, _householdId: string): Promise<null> {
    return null;
  }

  async getOccurrenceByDate(_appointmentId: string, _occurrenceDate: string, _householdId: string): Promise<null> {
    return null;
  }

  async listOccurrences(_appointmentId: string, _householdId: string, _fromDate?: string, _toDate?: string): Promise<never[]> {
    return [];
  }

  async listAllHouseholdOccurrencesInRange(_householdId: string, _fromDate: string, _toDate: string): Promise<never[]> {
    return [];
  }

  async createOccurrence(_input: unknown): Promise<never> {
    throw new Error('Occurrence operations not implemented in InMemoryRepository');
  }

  async updateOccurrence(_occurrenceId: string, _householdId: string, _input: unknown): Promise<never> {
    throw new Error('Occurrence operations not implemented in InMemoryRepository');
  }

  async deleteOccurrence(_occurrenceId: string, _householdId: string): Promise<void> {
    throw new Error('Occurrence operations not implemented in InMemoryRepository');
  }

  // Task methods - stub implementations for test compatibility
  async listHouseholdTasks(_householdId: string, _filters?: unknown): Promise<never[]> {
    return [];
  }

  async getTaskById(_taskId: string, _householdId: string): Promise<null> {
    return null;
  }

  async createTask(_input: unknown): Promise<never> {
    throw new Error('Task operations not implemented in InMemoryRepository');
  }

  async updateTask(_taskId: string, _householdId: string, _input: unknown): Promise<never> {
    throw new Error('Task operations not implemented in InMemoryRepository');
  }

  async deleteTask(_taskId: string, _householdId: string): Promise<void> {
    throw new Error('Task operations not implemented in InMemoryRepository');
  }

  async completeTask(_taskId: string, _householdId: string, _input: unknown, _completedBy: string): Promise<never> {
    throw new Error('Task operations not implemented in InMemoryRepository');
  }

  async confirmTask(_taskId: string, _householdId: string, _confirmedBy: string): Promise<never> {
    throw new Error('Task operations not implemented in InMemoryRepository');
  }

  async listUnconfirmedTasks(): Promise<never[]> {
    return [];
  }

  async markConfirmationNotified(_taskIds: string[]): Promise<void> {
    // no-op
  }

  // Task Reminder methods - stub implementations for test compatibility
  async listTaskReminders(_taskId: string, _householdId: string): Promise<never[]> {
    return [];
  }

  async getTaskReminderById(_reminderId: string, _taskId: string, _householdId: string): Promise<null> {
    return null;
  }

  async createTaskReminder(_input: unknown): Promise<never> {
    throw new Error('Task reminder operations not implemented in InMemoryRepository');
  }

  async updateTaskReminder(_reminderId: string, _taskId: string, _householdId: string, _input: unknown): Promise<never> {
    throw new Error('Task reminder operations not implemented in InMemoryRepository');
  }

  async deleteTaskReminder(_reminderId: string, _taskId: string, _householdId: string): Promise<void> {
    throw new Error('Task reminder operations not implemented in InMemoryRepository');
  }

  // Display Tablet methods - stub implementations for test compatibility
  async listHouseholdDisplayTablets(_householdId: string): Promise<never[]> {
    throw new Error('Display tablet operations not implemented in InMemoryRepository');
  }

  async getDisplayTabletById(_tabletId: string, _householdId: string): Promise<never> {
    throw new Error('Display tablet operations not implemented in InMemoryRepository');
  }

  async createDisplayTablet(_input: unknown): Promise<never> {
    throw new Error('Display tablet operations not implemented in InMemoryRepository');
  }

  async updateDisplayTablet(_tabletId: string, _householdId: string, _input: unknown): Promise<never> {
    throw new Error('Display tablet operations not implemented in InMemoryRepository');
  }

  async revokeDisplayTablet(_tabletId: string, _householdId: string, _revokedBy: string): Promise<void> {
    throw new Error('Display tablet operations not implemented in InMemoryRepository');
  }

  async deleteDisplayTablet(_tabletId: string, _householdId: string): Promise<void> {
    throw new Error('Display tablet operations not implemented in InMemoryRepository');
  }

  async regenerateDisplayTabletToken(_tabletId: string, _householdId: string): Promise<never> {
    throw new Error('Display tablet operations not implemented in InMemoryRepository');
  }

  async authenticateDisplayTablet(
    _tabletId: string,
    _setupToken: string,
    _refreshToken: string,
    _refreshTokenExpiresAt: string,
  ): Promise<null> {
    // InMemory repository doesn't support display tablets
    return null;
  }

  async refreshDisplayTabletSession(
    _tabletId: string,
    _refreshToken: string,
    _nextRefreshToken: string,
    _nextRefreshTokenExpiresAt: string,
  ): Promise<null> {
    return null;
  }

  async countActiveDisplayTablets(_householdId: string): Promise<number> {
    throw new Error('Display tablet operations not implemented in InMemoryRepository');
  }

  async updateDisplayTabletConfig(_tabletId: string, _householdId: string, _config: TabletDisplayConfig): Promise<DisplayTablet> {
    throw new Error('Display tablet operations not implemented in InMemoryRepository');
  }

  // Photo Screen methods - stub implementations for test compatibility
  async listPhotoScreens(_tabletId: string, _householdId: string): Promise<never[]> {
    throw new Error('Photo screen operations not implemented in InMemoryRepository');
  }

  async getPhotoScreenById(_photoScreenId: string, _tabletId: string, _householdId: string): Promise<null> {
    return null;
  }

  async createPhotoScreen(_input: unknown): Promise<never> {
    throw new Error('Photo screen operations not implemented in InMemoryRepository');
  }

  async updatePhotoScreen(_photoScreenId: string, _tabletId: string, _householdId: string, _input: unknown): Promise<never> {
    throw new Error('Photo screen operations not implemented in InMemoryRepository');
  }

  async deletePhotoScreen(_photoScreenId: string, _tabletId: string, _householdId: string): Promise<void> {
    throw new Error('Photo screen operations not implemented in InMemoryRepository');
  }

  async countPhotoScreens(_tabletId: string): Promise<number> {
    return 0;
  }

  // Photo methods - stub implementations for test compatibility
  async listPhotos(_photoScreenId: string, _householdId: string): Promise<never[]> {
    return [];
  }

  async countPhotos(_photoScreenId: string): Promise<number> {
    return 0;
  }

  async getPhotoById(_photoId: string, _photoScreenId: string, _householdId: string): Promise<null> {
    return null;
  }

  async createPhoto(_input: unknown): Promise<never> {
    throw new Error('Photo operations not implemented in InMemoryRepository');
  }

  async updatePhoto(_photoId: string, _photoScreenId: string, _householdId: string, _input: unknown): Promise<never> {
    throw new Error('Photo operations not implemented in InMemoryRepository');
  }

  async deletePhoto(_photoId: string, _photoScreenId: string, _householdId: string): Promise<void> {
    throw new Error('Photo operations not implemented in InMemoryRepository');
  }

  async reorderPhotos(_photoScreenId: string, _householdId: string, _photoOrders: unknown): Promise<never[]> {
    throw new Error('Photo operations not implemented in InMemoryRepository');
  }

  async deletePhotosByScreenId(_photoScreenId: string, _householdId: string): Promise<void> {
    throw new Error('Photo operations not implemented in InMemoryRepository');
  }

  // Text Screen methods - stub implementations for test compatibility
  async listTextScreens(_tabletId: string, _householdId: string): Promise<never[]> {
    return [];
  }

  async getTextScreenById(_textScreenId: string, _tabletId: string, _householdId: string): Promise<null> {
    return null;
  }

  async createTextScreen(_input: unknown): Promise<never> {
    throw new Error('Text screen operations not implemented in InMemoryRepository');
  }

  async updateTextScreen(_textScreenId: string, _tabletId: string, _householdId: string, _input: unknown): Promise<never> {
    throw new Error('Text screen operations not implemented in InMemoryRepository');
  }

  async deleteTextScreen(_textScreenId: string, _tabletId: string, _householdId: string): Promise<void> {
    throw new Error('Text screen operations not implemented in InMemoryRepository');
  }

  async countTextScreens(_tabletId: string, _householdId: string): Promise<number> {
    return 0;
  }

  // Privacy Settings - stub implementations for test compatibility
  async getUserPrivacySettings(_userId: string): Promise<null> {
    return null;
  }

  async updateUserPrivacySettings(_userId: string, _input: unknown): Promise<never> {
    throw new Error('Privacy settings operations not implemented in InMemoryRepository');
  }

  async getBulkPrivacySettings(_userIds: string[]): Promise<Map<string, PrivacySettings>> {
    return new Map();
  }

  async listDocumentsByFolderPaginated(householdId: string, folderId: string, limit: number, offset: number): Promise<{ documents: Document[]; hasMore: boolean }> {
    const all = documents.filter(
      (d) => d.folderId === folderId && d.householdId === householdId && !d.deletedAt && !d.trashedAt,
    );
    const page = all.slice(offset, offset + limit);
    return { documents: page, hasMore: offset + limit < all.length };
  }

  async getStorageStats(householdId: string): Promise<{ usedBytes: number; quotaBytes: number }> {
    const usedBytes = documents
      .filter((d) => d.householdId === householdId && !d.deletedAt)
      .reduce((sum, d) => sum + d.fileSizeBytes, 0);
    return { usedBytes, quotaBytes: 5368709120 }; // 5 GB default
  }

  async getHouseholdSettings(householdId: string): Promise<HouseholdSettings> {
    const existing = householdSettingsStore.get(householdId);
    const next = this.buildHouseholdSettings(householdId, existing);
    householdSettingsStore.set(householdId, next);
    return next;
  }

  async updateHouseholdSettings(householdId: string, input: UpdateHouseholdSettingsInput): Promise<HouseholdSettings> {
    const current = await this.getHouseholdSettings(householdId);
    const updatedAt = nowIso();

    // memberPermissions updates are ignored in memory — derived purely from member roles.
    const next: HouseholdSettings = {
      ...current,
      notifications: {
        ...current.notifications,
        ...(input.notifications ?? {}),
      },
      seniorMenuPin: input.seniorMenuPin !== undefined ? input.seniorMenuPin : current.seniorMenuPin ?? null,
      updatedAt,
    };

    householdSettingsStore.set(householdId, next);
    return next;
  }

  async updateHouseholdName(householdId: string, name: string): Promise<Household> {
    const household = households.find((item) => item.id === householdId);
    if (!household) {
      throw new NotFoundError('Household not found.');
    }

    household.name = name.trim();
    household.updatedAt = nowIso();
    return household;
  }

  // Documents
  async getDocumentFolderById(folderId: string, householdId: string): Promise<DocumentFolder | null> {
    return documentFolders.find(
      (folder) => folder.id === folderId && folder.householdId === householdId && !folder.deletedAt
    ) ?? null;
  }

  async listDocumentFoldersByParent(householdId: string, parentFolderId: string | null): Promise<DocumentFolderWithCounts[]> {
    return documentFolders.filter(
      (folder) =>
        folder.householdId === householdId &&
        folder.parentFolderId === parentFolderId &&
        !folder.deletedAt
    ).sort((a, b) => a.name.localeCompare(b.name)).map((folder) => ({
      ...folder,
      documentCount: documents.filter((d) => d.folderId === folder.id && !d.deletedAt).length,
      folderCount: documentFolders.filter((f) => f.parentFolderId === folder.id && !f.deletedAt).length,
    }));
  }

  async createDocumentFolder(input: CreateDocumentFolderInput): Promise<DocumentFolder> {
    const now = nowIso();

    // Determine type based on input
    let type: DocumentFolderType;
    if (input.type) {
      type = input.type;
    } else if (input.isSystemRoot) {
      type = 'system_root';
    } else if (input.seniorId) {
      type = 'senior_folder';
    } else {
      type = 'user_folder';
    }

    // Determine systemRootType
    let systemRootType: SystemRootType | null = input.systemRootType ?? null;
    if (type === 'system_root' && !systemRootType) {
      // Default to 'personal' if not specified
      systemRootType = 'personal';
    }

    const folder: DocumentFolder = {
      id: randomUUID(),
      householdId: input.householdId,
      parentFolderId: input.parentFolderId ?? null,
      seniorId: input.seniorId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      type,
      systemRootType,
      createdByUserId: input.createdByUserId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      trashedAt: null,
      originalParentFolderId: null,
    };
    documentFolders.push(folder);
    return folder;
  }

  async updateDocumentFolder(folderId: string, householdId: string, input: UpdateDocumentFolderInput): Promise<DocumentFolder> {
    const index = documentFolders.findIndex(
      (folder) => folder.id === folderId && folder.householdId === householdId && !folder.deletedAt
    );
    if (index === -1) {
      throw new NotFoundError('Document folder not found.');
    }
    const folder = documentFolders[index]!;
    const updated: DocumentFolder = {
      id: folder.id,
      householdId: folder.householdId,
      parentFolderId: folder.parentFolderId,
      seniorId: folder.seniorId,
      name: input.name?.trim() ?? folder.name,
      description: input.description !== undefined ? (input.description?.trim() ?? null) : folder.description,
      type: folder.type,
      systemRootType: folder.systemRootType,
      createdByUserId: folder.createdByUserId,
      createdAt: folder.createdAt,
      updatedAt: nowIso(),
      deletedAt: folder.deletedAt,
      trashedAt: folder.trashedAt,
      originalParentFolderId: folder.originalParentFolderId,
    };
    documentFolders[index] = updated;
    return updated;
  }

  async softDeleteDocumentFolder(folderId: string, householdId: string): Promise<void> {
    const index = documentFolders.findIndex(
      (folder) => folder.id === folderId && folder.householdId === householdId && !folder.deletedAt
    );
    if (index === -1) {
      throw new NotFoundError('Document folder not found.');
    }
    const folder = documentFolders[index]!;
    documentFolders[index] = {
      id: folder.id,
      householdId: folder.householdId,
      parentFolderId: folder.parentFolderId,
      seniorId: folder.seniorId,
      name: folder.name,
      description: folder.description,
      type: folder.type,
      systemRootType: folder.systemRootType,
      createdByUserId: folder.createdByUserId,
      createdAt: folder.createdAt,
      updatedAt: nowIso(),
      deletedAt: nowIso(),
      trashedAt: folder.trashedAt,
      originalParentFolderId: folder.originalParentFolderId,
    };
  }

  async restoreDocumentFolder(folderId: string, householdId: string): Promise<void> {
    const index = documentFolders.findIndex(
      (folder) => folder.id === folderId && folder.householdId === householdId && folder.deletedAt !== null
    );
    if (index === -1) {
      throw new NotFoundError('Deleted document folder not found.');
    }
    const folder = documentFolders[index]!;
    documentFolders[index] = {
      id: folder.id,
      householdId: folder.householdId,
      parentFolderId: folder.parentFolderId,
      seniorId: folder.seniorId,
      name: folder.name,
      description: folder.description,
      type: folder.type,
      systemRootType: folder.systemRootType,
      createdByUserId: folder.createdByUserId,
      createdAt: folder.createdAt,
      updatedAt: nowIso(),
      deletedAt: null,
      trashedAt: folder.trashedAt,
      originalParentFolderId: folder.originalParentFolderId,
    };
  }

  async getSystemRootFolder(householdId: string, systemRootType: 'personal' | 'administrative' | 'trash'): Promise<DocumentFolderWithCounts | null> {
    const folder = documentFolders.find(
      (f) =>
        f.householdId === householdId &&
        f.type === 'system_root' &&
        f.systemRootType === systemRootType &&
        !f.deletedAt
    ) ?? null;
    if (!folder) return null;
    return {
      ...folder,
      documentCount: documents.filter((d) => d.folderId === folder.id && !d.deletedAt).length,
      folderCount: documentFolders.filter((f) => f.parentFolderId === folder.id && !f.deletedAt).length,
    };
  }

  async ensureSystemRootsForHousehold(householdId: string, userId: string): Promise<void> {
    const types: ('personal' | 'administrative')[] = ['personal', 'administrative'];
    for (const type of types) {
      const existing = await this.getSystemRootFolder(householdId, type);
      if (!existing) {
        await this.createDocumentFolder({
          householdId,
          parentFolderId: null,
          name: type === 'personal' ? 'Personal Documents' : 'Administrative Documents',
          description: type === 'personal' ? 'Personal records and documents' : 'Administrative and legal documents',
          type: 'system_root',
          systemRootType: type,
          createdByUserId: userId,
        });
      }
    }
  }

  async ensureSeniorFoldersForHousehold(_householdId: string, _personalRootId: string, _userId: string): Promise<void> {
    // No-op in in-memory repository (used for tests only)
  }

  async listSeniorFolders(householdId: string): Promise<DocumentFolderWithCounts[]> {
    return documentFolders.filter(
      (folder) => folder.householdId === householdId && folder.seniorId !== null && !folder.deletedAt
    ).sort((a, b) => a.name.localeCompare(b.name)).map((folder) => ({
      ...folder,
      documentCount: documents.filter((d) => d.folderId === folder.id && !d.deletedAt).length,
      folderCount: documentFolders.filter((f) => f.parentFolderId === folder.id && !f.deletedAt).length,
    }));
  }

  async getDocumentById(documentId: string, householdId: string): Promise<Document | null> {
    return documents.find(
      (doc) => doc.id === documentId && doc.householdId === householdId && !doc.deletedAt
    ) ?? null;
  }

  async listDocumentsByFolder(householdId: string, folderId: string): Promise<Document[]> {
    return documents.filter(
      (doc) => doc.householdId === householdId && doc.folderId === folderId && !doc.deletedAt
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  async createDocument(input: CreateDocumentInput): Promise<Document> {
    const now = nowIso();
    const document: Document = {
      id: randomUUID(),
      householdId: input.householdId,
      folderId: input.folderId,
      seniorId: input.seniorId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      originalFilename: input.originalFilename,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      fileSizeBytes: input.fileSizeBytes,
      extension: input.extension,
      eventDate: input.eventDate ?? null,
      category: input.category ?? null,
      tags: input.tags ?? [],
      uploadedByUserId: input.uploadedByUserId,
      uploadedAt: now,
      updatedAt: now,
      deletedAt: null,
      trashedAt: null,
      originalFolderId: null,
    };
    documents.push(document);
    return document;
  }

  async updateDocument(documentId: string, householdId: string, input: UpdateDocumentInput): Promise<Document> {
    const index = documents.findIndex(
      (doc) => doc.id === documentId && doc.householdId === householdId && !doc.deletedAt
    );
    if (index === -1) {
      throw new NotFoundError('Document not found.');
    }
    const doc = documents[index]!;
    const updated: Document = {
      id: doc.id,
      householdId: doc.householdId,
      folderId: input.folderId ?? doc.folderId,
      seniorId: input.seniorId !== undefined ? input.seniorId : doc.seniorId,
      name: input.name?.trim() ?? doc.name,
      description: input.description !== undefined ? (input.description?.trim() ?? null) : doc.description,
      originalFilename: doc.originalFilename,
      storageKey: doc.storageKey,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      extension: doc.extension,
      eventDate: input.eventDate !== undefined ? input.eventDate : doc.eventDate,
      category: input.category !== undefined ? input.category : doc.category,
      tags: input.tags !== undefined ? input.tags : doc.tags,
      uploadedByUserId: doc.uploadedByUserId,
      uploadedAt: doc.uploadedAt,
      updatedAt: nowIso(),
      deletedAt: doc.deletedAt,
      trashedAt: doc.trashedAt,
      originalFolderId: doc.originalFolderId,
    };
    documents[index] = updated;
    return updated;
  }

  async softDeleteDocument(documentId: string, householdId: string): Promise<void> {
    const index = documents.findIndex(
      (doc) => doc.id === documentId && doc.householdId === householdId && !doc.deletedAt
    );
    if (index === -1) {
      throw new NotFoundError('Document not found.');
    }
    const doc = documents[index]!;
    documents[index] = {
      id: doc.id,
      householdId: doc.householdId,
      folderId: doc.folderId,
      seniorId: doc.seniorId,
      name: doc.name,
      description: doc.description,
      originalFilename: doc.originalFilename,
      storageKey: doc.storageKey,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      extension: doc.extension,
      eventDate: doc.eventDate,
      category: doc.category,
      tags: doc.tags,
      uploadedByUserId: doc.uploadedByUserId,
      uploadedAt: doc.uploadedAt,
      updatedAt: nowIso(),
      deletedAt: nowIso(),
      trashedAt: doc.trashedAt,
      originalFolderId: doc.originalFolderId,
    };
  }

  async hardDeleteDocument(documentId: string, householdId: string): Promise<{ storageKey: string }> {
    const index = documents.findIndex((doc) => doc.id === documentId && doc.householdId === householdId);
    if (index === -1) throw new NotFoundError('Document not found.');
    const storageKey = documents[index]!.storageKey;
    documents.splice(index, 1);
    return { storageKey };
  }

  async hardDeleteDocumentFolder(folderId: string, householdId: string): Promise<{ storageKeys: string[] }> {
    // Collect subtree folder IDs (BFS)
    const subtreeIds: string[] = [];
    const queue = [folderId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      subtreeIds.push(current);
      const children = documentFolders.filter(
        (f) => f.parentFolderId === current && f.householdId === householdId,
      );
      queue.push(...children.map((c) => c.id));
    }
    if (subtreeIds.length === 0) throw new NotFoundError('Folder not found.');

    const storageKeys: string[] = [];
    // Remove documents in subtree
    for (let i = documents.length - 1; i >= 0; i--) {
      if (subtreeIds.includes(documents[i]!.folderId) && documents[i]!.householdId === householdId) {
        storageKeys.push(documents[i]!.storageKey);
        documents.splice(i, 1);
      }
    }
    // Remove folders in subtree
    for (let i = documentFolders.length - 1; i >= 0; i--) {
      if (subtreeIds.includes(documentFolders[i]!.id) && documentFolders[i]!.householdId === householdId) {
        documentFolders.splice(i, 1);
      }
    }
    return { storageKeys };
  }

  async restoreDocument(documentId: string, householdId: string): Promise<void> {
    const index = documents.findIndex(
      (doc) => doc.id === documentId && doc.householdId === householdId && doc.deletedAt !== null
    );
    if (index === -1) {
      throw new NotFoundError('Deleted document not found.');
    }
    const doc = documents[index]!;
    documents[index] = {
      id: doc.id,
      householdId: doc.householdId,
      folderId: doc.folderId,
      seniorId: doc.seniorId,
      name: doc.name,
      description: doc.description,
      originalFilename: doc.originalFilename,
      storageKey: doc.storageKey,
      mimeType: doc.mimeType,
      fileSizeBytes: doc.fileSizeBytes,
      extension: doc.extension,
      eventDate: doc.eventDate,
      category: doc.category,
      tags: doc.tags,
      uploadedByUserId: doc.uploadedByUserId,
      uploadedAt: doc.uploadedAt,
      updatedAt: nowIso(),
      deletedAt: null,
      trashedAt: doc.trashedAt,
      originalFolderId: doc.originalFolderId,
    };
  }

  async moveDocumentFolderToTrash(folderId: string, householdId: string, trashFolderId: string): Promise<void> {
    const index = documentFolders.findIndex((f) => f.id === folderId && f.householdId === householdId && !f.deletedAt);
    if (index === -1) throw new NotFoundError('Document folder not found.');
    const folder = documentFolders[index]!;
    documentFolders[index] = { ...folder, parentFolderId: trashFolderId, trashedAt: nowIso(), originalParentFolderId: folder.parentFolderId, updatedAt: nowIso() };
  }

  async moveDocumentToTrash(documentId: string, householdId: string, trashFolderId: string): Promise<void> {
    const index = documents.findIndex((d) => d.id === documentId && d.householdId === householdId && !d.deletedAt);
    if (index === -1) throw new NotFoundError('Document not found.');
    const doc = documents[index]!;
    documents[index] = { ...doc, folderId: trashFolderId, trashedAt: nowIso(), originalFolderId: doc.folderId, updatedAt: nowIso() };
  }

  async restoreDocumentFolderFromTrash(folderId: string, householdId: string): Promise<void> {
    const index = documentFolders.findIndex((f) => f.id === folderId && f.householdId === householdId && f.trashedAt !== null);
    if (index === -1) throw new NotFoundError('Trashed document folder not found.');
    const folder = documentFolders[index]!;
    documentFolders[index] = { ...folder, parentFolderId: folder.originalParentFolderId, trashedAt: null, originalParentFolderId: null, updatedAt: nowIso() };
  }

  async restoreDocumentFromTrash(documentId: string, householdId: string): Promise<void> {
    const index = documents.findIndex((d) => d.id === documentId && d.householdId === householdId && d.trashedAt !== null);
    if (index === -1) throw new NotFoundError('Trashed document not found.');
    const doc = documents[index]!;
    documents[index] = { ...doc, folderId: doc.originalFolderId ?? doc.folderId, trashedAt: null, originalFolderId: null, updatedAt: nowIso() };
  }

  async purgeExpiredTrashItems(householdId: string, retentionDays: number): Promise<{ folders: number; documents: number }> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    let folders = 0;
    let docs = 0;
    for (let i = 0; i < documentFolders.length; i++) {
      const f = documentFolders[i]!;
      if (f.householdId === householdId && f.trashedAt && f.trashedAt < cutoff && !f.deletedAt) {
        documentFolders[i] = { ...f, deletedAt: nowIso() };
        folders++;
      }
    }
    for (let i = 0; i < documents.length; i++) {
      const d = documents[i]!;
      if (d.householdId === householdId && d.trashedAt && d.trashedAt < cutoff && !d.deletedAt) {
        documents[i] = { ...d, deletedAt: nowIso() };
        docs++;
      }
    }
    return { folders, documents: docs };
  }

  async searchDocumentsAndFolders(householdId: string, query: string, folderId?: string | null): Promise<{
    folders: DocumentFolder[];
    documents: Document[];
  }> {
    const normalizedQuery = query.toLowerCase().trim();
    if (!normalizedQuery) {
      return { folders: [], documents: [] };
    }

    // Collect all folder IDs in the subtree if folderId is given
    let allowedFolderIds: Set<string> | null = null;
    if (folderId) {
      allowedFolderIds = new Set<string>();
      const queue = [folderId];
      while (queue.length > 0) {
        const current = queue.shift()!;
        allowedFolderIds.add(current);
        documentFolders
          .filter(f => f.parentFolderId === current && f.householdId === householdId && !f.deletedAt)
          .forEach(f => queue.push(f.id));
      }
    }

    const filteredFolders = documentFolders.filter(
      (folder) =>
        folder.householdId === householdId &&
        !folder.deletedAt &&
        (!allowedFolderIds || allowedFolderIds.has(folder.id)) &&
        (folder.name.toLowerCase().includes(normalizedQuery) ||
          (folder.description && folder.description.toLowerCase().includes(normalizedQuery)))
    );
    const filteredDocuments = documents.filter(
      (doc) =>
        doc.householdId === householdId &&
        !doc.deletedAt &&
        (!allowedFolderIds || allowedFolderIds.has(doc.folderId)) &&
        (doc.name.toLowerCase().includes(normalizedQuery) ||
          doc.originalFilename.toLowerCase().includes(normalizedQuery))
    );
    return {
      folders: filteredFolders,
      documents: filteredDocuments,
    };
  }

  // Emergency Contacts (in-memory stubs)
  async listEmergencyContacts(_householdId: string): Promise<EmergencyContact[]> { return []; }
  async getEmergencyContactById(_contactId: string, _householdId: string): Promise<EmergencyContact | null> { return null; }
  async createEmergencyContact(input: CreateEmergencyContactInput): Promise<EmergencyContact> {
    const now = new Date().toISOString();
    return { id: randomUUID(), ...input, relationship: input.relationship ?? null, createdAt: now, updatedAt: now };
  }
  async updateEmergencyContact(contactId: string, _householdId: string, _input: UpdateEmergencyContactInput): Promise<EmergencyContact> {
    throw new NotFoundError(`EmergencyContact ${contactId} not found`);
  }
  async deleteEmergencyContact(_contactId: string, _householdId: string): Promise<void> {}
  async reorderEmergencyContacts(_householdId: string, _orderedIds: string[]): Promise<void> {}
  async getCaregiverPushTokens(_householdId: string): Promise<string[]> { return []; }

  // Senior Devices (stubs for in-memory)
  async listHouseholdSeniorDevices(_householdId: string): Promise<any[]> { return []; }
  async getSeniorDeviceById(_deviceId: string, _householdId: string): Promise<any> { return null; }
  async createSeniorDevice(_input: any): Promise<any> { throw new Error('Not implemented in-memory'); }
  async authenticateSeniorDevice(_deviceId: string, _setupToken: string, _refreshToken: string, _refreshTokenExpiresAt: string): Promise<any> { return null; }
  async refreshSeniorDeviceSession(_deviceId: string, _refreshToken: string, _nextRefreshToken: string, _nextRefreshTokenExpiresAt: string): Promise<any> { return null; }
  async revokeSeniorDevice(_deviceId: string, _householdId: string, _revokedBy: string): Promise<void> {}
  async revokeAllSeniorDevicesForMember(_memberId: string, _householdId: string, _revokedBy: string): Promise<void> {}
  async countActiveSeniorDevices(_householdId: string): Promise<number> { return 0; }
  async archiveMember(_memberId: string, _householdId: string): Promise<void> {}
  async restoreMember(_memberId: string, _householdId: string): Promise<void> {}
  async listArchivedHouseholdMembers(_householdId: string): Promise<any[]> { return []; }
  async createProxyMember(_input: any): Promise<{ id: string }> { throw new Error('Not implemented in-memory'); }

  // Caregiver Todos stubs
  async listCaregiverTodos(_householdId: string, _filters?: any): Promise<any[]> { return []; }
  async getCaregiverTodoById(_todoId: string, _householdId: string) { return null; }
  async createCaregiverTodo(_input: any): Promise<any> { throw new Error('Not implemented in-memory'); }
  async updateCaregiverTodo(_todoId: string, _householdId: string, _input: any): Promise<any> { throw new Error('Not implemented in-memory'); }
  async deleteCaregiverTodo(_todoId: string, _householdId: string): Promise<void> { throw new Error('Not implemented in-memory'); }
  async completeCaregiverTodo(_todoId: string, _householdId: string, _completedBy: string): Promise<any> { throw new Error('Not implemented in-memory'); }
  async nudgeCaregiverTodo(_todoId: string, _householdId: string): Promise<any> { throw new Error('Not implemented in-memory'); }
  async addCaregiverTodoComment(_input: any): Promise<any> { throw new Error('Not implemented in-memory'); }

  // Email auth stubs
  async findEmailAccountById(_id: string) { return null; }
  async findEmailAccountByEmail(_email: string) { return null; }
  async findEmailAccountByUserId(_userId: string) { return null; }
  async createEmailAccount(_input: any): Promise<any> { throw new Error('Not implemented in-memory'); }
  async createEmailAuthSession(_accountId: string): Promise<{ refreshToken: string }> { throw new Error('Not implemented in-memory'); }
  async findEmailAuthSession(_refreshToken: string) { return null; }
  async rotateEmailAuthSession(_sessionId: string, _accountId: string): Promise<{ refreshToken: string }> { throw new Error('Not implemented in-memory'); }

  // Subscription stubs
  async getActiveSubscription(_householdId: string) { return null; }
  async getSubscriptionByRcAppUserId(_rcAppUserId: string) { return null; }
  async createSubscription(householdId: string, plan: any): Promise<any> {
    return { id: randomUUID(), householdId, plan, status: 'active', rcAppUserId: null, rcOriginalTransactionId: null, rcProductId: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, createdAt: nowIso(), updatedAt: nowIso() };
  }
  async updateSubscription(_subscriptionId: string, _input: any): Promise<any> { throw new Error('Not implemented in-memory'); }
  async ensureDefaultSubscription(householdId: string): Promise<any> {
    return { id: randomUUID(), householdId, plan: 'gratuit', status: 'active', rcAppUserId: null, rcOriginalTransactionId: null, rcProductId: null, currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, createdAt: nowIso(), updatedAt: nowIso() };
  }
}
