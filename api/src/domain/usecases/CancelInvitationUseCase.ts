import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class CancelInvitationUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

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
