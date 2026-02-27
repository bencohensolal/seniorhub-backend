import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import type { AuthenticatedRequester, Household, HouseholdOverview } from '../../domain/entities/Household.js';
import type { AuditEvent, AuditEventInput, HouseholdInvitation } from '../../domain/entities/Invitation.js';
import type { HouseholdRole, Member } from '../../domain/entities/Member.js';
import { signInvitationToken, isInvitationTokenValid } from '../../domain/security/invitationToken.js';
import { buildInvitationLinks } from '../../domain/services/buildInvitationLinks.js';
import type {
  BulkInvitationResult,
  HouseholdRepository,
  InvitationCandidate,
} from '../../domain/repositories/HouseholdRepository.js';
import type { Medication, CreateMedicationInput, UpdateMedicationInput } from '../../domain/entities/Medication.js';
import { nowIso, addHours, hashToken, normalizeEmail, normalizeName } from './postgres/helpers.js';

const INVITATION_TTL_HOURS = 72;

const buildDisplayName = (firstName: string, lastName: string): { firstName: string; lastName: string } => ({
  firstName: normalizeName(firstName),
  lastName: normalizeName(lastName),
});

const households: Household[] = [
  {
    id: 'household-1',
    name: 'Martin Family Home',
    createdByUserId: 'user-2',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

const members: Member[] = [
  {
    id: 'member-1',
    householdId: 'household-1',
    userId: 'user-1',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Martin',
    role: 'senior',
    status: 'active',
    joinedAt: nowIso(),
    createdAt: nowIso(),
  },
  {
    id: 'member-2',
    householdId: 'household-1',
    userId: 'user-2',
    email: 'ben@example.com',
    firstName: 'Ben',
    lastName: 'Martin',
    role: 'caregiver',
    status: 'active',
    joinedAt: nowIso(),
    createdAt: nowIso(),
  },
];

const invitations: HouseholdInvitation[] = [];
const auditEvents: AuditEvent[] = [];

export const forceExpireInvitationForTests = (invitationId: string): void => {
  const invitation = invitations.find((item) => item.id === invitationId);
  if (!invitation) {
    return;
  }

  invitation.tokenExpiresAt = new Date(Date.now() - 1000).toISOString();
};

export class InMemoryHouseholdRepository implements HouseholdRepository {
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
    });

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
          normalizeEmail(member.email) === email &&
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
        createdAt,
        acceptedAt: null,
      };

      invitations.push(invitation);
      result.acceptedCount += 1;

      const links = buildInvitationLinks({
        token,
        ...(env.INVITATION_WEB_FALLBACK_URL
          ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL }
          : {}),
      });

      result.deliveries.push({
        invitationId: invitation.id,
        inviteeEmail: email,
        status: 'sent',
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
        throw new Error('Invitation not found.');
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
      throw new Error('Invitation not found.');
    }

    if (invitation.inviteeEmail !== email) {
      throw new Error('Access denied to this invitation.');
    }

    if (invitation.status !== 'pending') {
      throw new Error('Invitation is not pending.');
    }

    if (new Date(invitation.tokenExpiresAt) <= new Date()) {
      invitation.status = 'expired';
      throw new Error('Invitation expired. Please request a new invitation.');
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
  }): Promise<{ newToken: string; newExpiresAt: string; deepLinkUrl: string; fallbackUrl: string | null }> {
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
      ...(env.INVITATION_WEB_FALLBACK_URL ? { fallbackBaseUrl: env.INVITATION_WEB_FALLBACK_URL } : {}),
    });

    return {
      newToken,
      newExpiresAt,
      deepLinkUrl: links.deepLinkUrl,
      fallbackUrl: links.fallbackUrl,
    };
  }

  async logAuditEvent(input: AuditEventInput): Promise<void> {
    auditEvents.push({
      id: randomUUID(),
      householdId: input.householdId,
      actorUserId: input.actorUserId,
      action: input.action,
      targetId: input.targetId,
      metadata: input.metadata,
      createdAt: nowIso(),
    });
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

  // Medication methods - stub implementations for test compatibility
  async listHouseholdMedications(_householdId: string): Promise<Medication[]> {
    return [];
  }

  async getMedicationById(_medicationId: string, _householdId: string): Promise<Medication | null> {
    return null;
  }

  async createMedication(_input: CreateMedicationInput): Promise<Medication> {
    throw new Error('Medication operations not implemented in InMemoryRepository');
  }

  async updateMedication(_medicationId: string, _householdId: string, _input: UpdateMedicationInput): Promise<Medication> {
    throw new Error('Medication operations not implemented in InMemoryRepository');
  }

  async deleteMedication(_medicationId: string, _householdId: string): Promise<void> {
    throw new Error('Medication operations not implemented in InMemoryRepository');
  }
}
