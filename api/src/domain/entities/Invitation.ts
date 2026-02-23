import type { HouseholdRole } from './Member.js';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface HouseholdInvitation {
  id: string;
  householdId: string;
  inviterUserId: string;
  inviteeEmail: string;
  inviteeFirstName: string;
  inviteeLastName: string;
  assignedRole: HouseholdRole;
  tokenHash: string;
  tokenExpiresAt: string;
  status: InvitationStatus;
  createdAt: string;
  acceptedAt: string | null;
}

export interface InvitationDeliveryResult {
  invitationId: string;
  inviteeEmail: string;
  status: 'sent' | 'failed';
  reason: string | null;
}
