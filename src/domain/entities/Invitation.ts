import type { HouseholdRole } from './Member.js';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface HouseholdInvitation {
  id: string;
  householdId: string;
  householdName: string;
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
  acceptLinkUrl: string; // Smart redirect URL (primary link)
  deepLinkUrl: string; // Legacy
  fallbackUrl: string | null; // Legacy
  reason: string | null;
}

export interface AuditEvent {
  id: string;
  householdId: string;
  actorUserId: string;
  action: 'invitation_created' | 'invitation_accepted' | 'invitation_cancelled' | 'invitation_resent';
  targetId: string;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface AuditEventInput {
  householdId: string;
  actorUserId: string;
  action: 'invitation_created' | 'invitation_accepted' | 'invitation_cancelled' | 'invitation_resent';
  targetId: string;
  metadata: Record<string, string>;
}
