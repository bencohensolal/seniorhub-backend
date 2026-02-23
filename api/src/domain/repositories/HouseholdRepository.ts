import type { HouseholdOverview } from '../entities/Household.js';
import type { Member } from '../entities/Member.js';
import type { Household, AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdInvitation, InvitationDeliveryResult } from '../entities/Invitation.js';
import type { HouseholdRole } from '../entities/Member.js';

export interface InvitationCandidate {
  firstName: string;
  lastName: string;
  email: string;
  role: HouseholdRole;
}

export interface BulkInvitationResult {
  acceptedCount: number;
  skippedDuplicates: number;
  perUserErrors: Array<{ email: string; reason: string }>;
  deliveries: InvitationDeliveryResult[];
}

export interface HouseholdRepository {
  getOverviewById(householdId: string): Promise<HouseholdOverview | null>;
  findMemberInHousehold(memberId: string, householdId: string): Promise<Member | null>;
  findActiveMemberByUserInHousehold(userId: string, householdId: string): Promise<Member | null>;
  createHousehold(name: string, requester: AuthenticatedRequester): Promise<Household>;
  createBulkInvitations(input: {
    householdId: string;
    inviterUserId: string;
    users: InvitationCandidate[];
  }): Promise<BulkInvitationResult>;
  listPendingInvitationsByEmail(email: string): Promise<HouseholdInvitation[]>;
  resolveInvitationByToken(token: string): Promise<HouseholdInvitation | null>;
  acceptInvitation(input: {
    requester: AuthenticatedRequester;
    token?: string;
    invitationId?: string;
  }): Promise<{ householdId: string; role: HouseholdRole }>;
}
