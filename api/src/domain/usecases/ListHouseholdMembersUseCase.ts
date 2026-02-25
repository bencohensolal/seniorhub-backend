import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../entities/Household.js';
import type { Member } from '../entities/Member.js';

export class ListHouseholdMembersUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: { householdId: string; requester: AuthenticatedRequester }): Promise<Member[]> {
    // Verify requester is a member of this household
    const membership = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!membership) {
      throw new Error('Access denied to this household.');
    }

    // Get all active members of the household
    const members = await this.repository.listHouseholdMembers(input.householdId);

    return members;
  }
}
