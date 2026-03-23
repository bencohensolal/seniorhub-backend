import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class DeleteEmergencyContactUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }
  async execute(input: {
    contactId: string;
    householdId: string;
    requesterUserId: string;
  }): Promise<void> {
    await this.accessValidator.ensureCaregiver(input.requesterUserId, input.householdId);
    return this.repository.deleteEmergencyContact(input.contactId, input.householdId);
  }
}
