import type { AuthenticatedRequester } from '../entities/Household.js';
import type { Medication } from '../entities/Medication.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class ListHouseholdMedicationsUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<Medication[]> {
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new Error('Access denied to this household.');
    }

    return this.repository.listHouseholdMedications(input.householdId);
  }
}
