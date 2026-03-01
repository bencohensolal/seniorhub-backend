import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

/**
 * Cancels a pending invitation.
 * Only caregivers can cancel invitations.
 * Repository handles access validation and business rules.
 */
export class CancelInvitationUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  /**
   * @param input - Invitation cancellation data with requester info
   * @throws {ForbiddenError} If requester is not a caregiver (thrown by repository)
   * @throws {NotFoundError} If invitation doesn't exist (thrown by repository)
   * @throws {ConflictError} If invitation is not pending (thrown by repository)
   */
  async execute(input: {
    householdId: string;
    invitationId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    await this.repository.cancelInvitation({
      householdId: input.householdId,
      invitationId: input.invitationId,
      requesterUserId: input.requester.userId,
    });
  }
}
