import type { HouseholdRole } from '../entities/Member.js';

const roleLabel = (role: HouseholdRole): string => (role === 'caregiver' ? 'Caregiver' : 'Senior');

export const buildInvitationEmailTemplate = (input: {
  firstName: string;
  assignedRole: HouseholdRole;
  deepLinkUrl: string;
  fallbackUrl: string | null;
}): { subject: string; body: string } => {
  const greetingName = input.firstName.trim() || 'there';
  const fallbackBlock = input.fallbackUrl
    ? `If the app is not installed yet, open this secure link:\n${input.fallbackUrl}\n\n`
    : '';

  return {
    subject: 'Senior Hub household invitation',
    body: `Hello ${greetingName},\n\nYou have been invited to join a Senior Hub household as ${roleLabel(
      input.assignedRole,
    )}.\n\nOpen this invitation in the app:\n${input.deepLinkUrl}\n\n${fallbackBlock}This invitation is single-use and expires automatically for safety.\n\nIf you were not expecting this email, you can ignore it.`,
  };
};
