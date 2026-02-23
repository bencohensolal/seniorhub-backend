import type { AuthenticatedRequester, Household } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class CreateHouseholdUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: { name: string; requester: AuthenticatedRequester }): Promise<Household> {
    return this.repository.createHousehold(input.name, input.requester);
  }
}
