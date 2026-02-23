import type { HouseholdOverview } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class GetHouseholdOverviewUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: { householdId: string; requesterMemberId: string }): Promise<HouseholdOverview> {
    const member = await this.repository.findMemberInHousehold(
      input.requesterMemberId,
      input.householdId,
    );

    if (!member) {
      throw new Error('Access denied to this household.');
    }

    const overview = await this.repository.getOverviewById(input.householdId);

    if (!overview) {
      throw new Error('Household not found.');
    }

    return overview;
  }
}
