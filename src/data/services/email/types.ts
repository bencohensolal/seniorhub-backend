import type { HouseholdRole } from '../../../domain/entities/Member.js';

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export interface InvitationEmailJob {
  invitationId: string;
  inviteeEmail: string;
  inviteeFirstName: string;
  assignedRole: HouseholdRole;
  acceptLinkUrl: string; // Smart redirect URL (new primary link)
  deepLinkUrl: string; // Legacy
  fallbackUrl: string | null; // Legacy
}
