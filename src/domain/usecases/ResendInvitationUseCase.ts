import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class ResendInvitationUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    invitationId: string;
    requester: AuthenticatedRequester;
  }): Promise<{ newExpiresAt: string; acceptLinkUrl: string; deepLinkUrl: string; fallbackUrl: string | null }> {
    const result = await this.repository.resendInvitation({
      householdId: input.householdId,
      invitationId: input.invitationId,
      requesterUserId: input.requester.userId,
    });

    // We don't return the token itself in the response, only the metadata
    return {
      newExpiresAt: result.newExpiresAt,
      acceptLinkUrl: result.acceptLinkUrl,
      deepLinkUrl: result.deepLinkUrl,
      fallbackUrl: result.fallbackUrl,
    };
  }
}
