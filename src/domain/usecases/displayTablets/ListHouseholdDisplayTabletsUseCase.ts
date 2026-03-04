import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DisplayTablet } from '../../entities/DisplayTablet.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class ListHouseholdDisplayTabletsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: { householdId: string; requesterUserId: string }): Promise<DisplayTablet[]> {
    // Validate household access
    await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    return this.repository.listHouseholdDisplayTablets(input.householdId);
  }
}
