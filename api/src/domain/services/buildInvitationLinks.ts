export interface InvitationLinks {
  deepLinkUrl: string;
  fallbackUrl: string | null;
}

export const buildInvitationLinks = (input: {
  token: string;
  fallbackBaseUrl?: string;
}): InvitationLinks => {
  const deepLinkUrl = `seniorhub://invite?type=household-invite&token=${encodeURIComponent(input.token)}`;

  if (!input.fallbackBaseUrl) {
    return {
      deepLinkUrl,
      fallbackUrl: null,
    };
  }

  const separator = input.fallbackBaseUrl.includes('?') ? '&' : '?';
  return {
    deepLinkUrl,
    fallbackUrl: `${input.fallbackBaseUrl}${separator}type=household-invite&token=${encodeURIComponent(input.token)}`,
  };
};
