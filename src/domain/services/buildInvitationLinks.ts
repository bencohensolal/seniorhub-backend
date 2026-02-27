export interface InvitationLinks {
  /** Smart redirect URL that detects mobile/web and redirects accordingly */
  acceptLinkUrl: string;
  /** Direct deep link to mobile app (legacy, for reference) */
  deepLinkUrl: string;
  /** Direct web URL (legacy, for reference) */
  fallbackUrl: string | null;
}

export const buildInvitationLinks = (input: {
  token: string;
  backendBaseUrl: string;
  fallbackBaseUrl?: string;
}): InvitationLinks => {
  // Smart redirect URL - this is what should be used in emails
  const acceptLinkUrl = `${input.backendBaseUrl}/v1/invitations/accept-link?token=${encodeURIComponent(input.token)}`;
  
  // Legacy deep link (mobile app)
  const deepLinkUrl = `seniorhub://invite?type=household-invite&token=${encodeURIComponent(input.token)}`;

  // Legacy fallback URL (web)
  let fallbackUrl: string | null = null;
  if (input.fallbackBaseUrl) {
    const separator = input.fallbackBaseUrl.includes('?') ? '&' : '?';
    fallbackUrl = `${input.fallbackBaseUrl}${separator}type=household-invite&token=${encodeURIComponent(input.token)}`;
  }

  return {
    acceptLinkUrl,
    deepLinkUrl,
    fallbackUrl,
  };
};
