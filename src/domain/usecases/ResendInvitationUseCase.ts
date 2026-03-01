import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

/**
 * Resends an invitation with a new token and expiration date.
 * Only caregivers can resend invitations.
 * Repository handles access validation and business rules.
 */
export class ResendInvitationUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  /**
   * @param input - Invitation resend data with requester info
   * @returns New invitation metadata (no token)
   * @throws {ForbiddenError} If requester is not a caregiver (thrown by repository)
   * @throws {NotFoundError} If invitation doesn't exist (thrown by repository)
   * @throws {ConflictError} If invitation cannot be resent (thrown by repository)
   */
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
