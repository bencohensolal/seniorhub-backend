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
  assignedRole: 'senior' | 'caregiver';
  deepLinkUrl: string;
  fallbackUrl: string | null;
}
