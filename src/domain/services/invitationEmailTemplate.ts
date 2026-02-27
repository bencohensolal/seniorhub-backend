import type { HouseholdRole } from '../entities/Member.js';
import { loadEmailTemplate } from './emailTemplateLoader.js';

const roleLabel = (role: HouseholdRole): string => (role === 'caregiver' ? 'Caregiver' : 'Senior');

/**
 * Build invitation email from template files
 * Templates are located in api/templates/emails/invitation/
 */
export async function buildInvitationEmailTemplate(input: {
  firstName: string;
  assignedRole: HouseholdRole;
  acceptLinkUrl: string; // Smart redirect URL (primary)
  deepLinkUrl: string; // Legacy support
  fallbackUrl: string | null; // Legacy support
}): Promise<{ subject: string; body: string }> {
  const greetingName = input.firstName.trim() || 'there';

  return loadEmailTemplate('invitation', {
    firstName: greetingName,
    role: roleLabel(input.assignedRole),
    acceptLinkUrl: input.acceptLinkUrl,
    deepLinkUrl: input.deepLinkUrl,
    fallbackUrl: input.fallbackUrl,
  });
}
