import type { HouseholdInvitation } from '../entities/Invitation.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class ListHouseholdInvitationsUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: { householdId: string; requesterUserId: string }): Promise<HouseholdInvitation[]> {
    // Verify requester is a member of the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requesterUserId,
      input.householdId,
    );

    if (!member) {
      throw new Error('Access denied to this household.');
    }

    return this.repository.listHouseholdInvitations(input.householdId);
  }
}
