import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class ReorderEmergencyContactsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }
  async execute(input: {
    householdId: string;
    orderedIds: string[];
    requesterUserId: string;
  }): Promise<void> {
    await this.accessValidator.ensureCaregiver(input.requesterUserId, input.householdId);
    return this.repository.reorderEmergencyContacts(input.householdId, input.orderedIds);
  }
}
