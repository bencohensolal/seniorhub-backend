import type { HouseholdOverview } from '../entities/Household.js';
import type { Member } from '../entities/Member.js';
import type { Household, AuthenticatedRequester } from '../entities/Household.js';
import type { AuditEventInput, HouseholdInvitation, InvitationDeliveryResult } from '../entities/Invitation.js';
import type { HouseholdRole } from '../entities/Member.js';
import type { Medication, CreateMedicationInput, UpdateMedicationInput } from '../entities/Medication.js';

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

export interface UserHouseholdMembership {
  householdId: string;
  householdName: string;
  myRole: HouseholdRole;
  joinedAt: string;
  memberCount: number;
}

export interface HouseholdRepository {
  getOverviewById(householdId: string): Promise<HouseholdOverview | null>;
  findMemberInHousehold(memberId: string, householdId: string): Promise<Member | null>;
  findMemberById(memberId: string): Promise<Member | null>;
  findActiveMemberByUserInHousehold(userId: string, householdId: string): Promise<Member | null>;
  listUserHouseholds(userId: string): Promise<UserHouseholdMembership[]>;
  listHouseholdMembers(householdId: string): Promise<Member[]>;
  createHousehold(name: string, requester: AuthenticatedRequester): Promise<Household>;
  createBulkInvitations(input: {
    householdId: string;
    inviterUserId: string;
    users: InvitationCandidate[];
  }): Promise<BulkInvitationResult>;
  listPendingInvitationsByEmail(email: string): Promise<HouseholdInvitation[]>;
  listHouseholdInvitations(householdId: string): Promise<HouseholdInvitation[]>;
  resolveInvitationByToken(token: string): Promise<HouseholdInvitation | null>;
  acceptInvitation(input: {
    requester: AuthenticatedRequester;
    token?: string;
    invitationId?: string;
  }): Promise<{ householdId: string; role: HouseholdRole }>;
  cancelInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<void>;
  resendInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<{ newToken: string; newExpiresAt: string; acceptLinkUrl: string; deepLinkUrl: string; fallbackUrl: string | null }>;
  removeMember(memberId: string): Promise<void>;
  updateMemberRole(memberId: string, newRole: HouseholdRole): Promise<Member>;
  logAuditEvent(input: AuditEventInput): Promise<void>;
  
  // Medications
  listHouseholdMedications(householdId: string): Promise<Medication[]>;
  getMedicationById(medicationId: string, householdId: string): Promise<Medication | null>;
  createMedication(input: CreateMedicationInput): Promise<Medication>;
  updateMedication(medicationId: string, householdId: string, input: UpdateMedicationInput): Promise<Medication>;
  deleteMedication(medicationId: string, householdId: string): Promise<void>;
}
