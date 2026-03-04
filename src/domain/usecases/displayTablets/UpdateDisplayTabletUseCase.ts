import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DisplayTablet } from '../../entities/DisplayTablet.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class UpdateDisplayTabletUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    tabletId: string;
    name?: string;
    description?: string;
    requesterUserId: string;
  }): Promise<DisplayTablet> {
    // Validate household access
    await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    // Update the tablet
    return this.repository.updateDisplayTablet(input.tabletId, input.householdId, {
      name: input.name,
      description: input.description,
    });
  }
}
