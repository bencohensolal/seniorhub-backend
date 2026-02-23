import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdInvitation } from '../entities/Invitation.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class ListPendingInvitationsUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: { requester: AuthenticatedRequester }): Promise<HouseholdInvitation[]> {
    return this.repository.listPendingInvitationsByEmail(input.requester.email);
  }
}
