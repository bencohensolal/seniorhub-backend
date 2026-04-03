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
  reactivationCount: number;
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

// Re-export from the centralized AuditEvent module for backward compatibility
export type { AuditEvent, AuditEventInput } from './AuditEvent.js';
