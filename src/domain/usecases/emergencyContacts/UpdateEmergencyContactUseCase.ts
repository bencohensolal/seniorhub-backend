import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { EmergencyContact, UpdateEmergencyContactInput } from '../../entities/EmergencyContact.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class UpdateEmergencyContactUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }
  async execute(input: {
    contactId: string;
    householdId: string;
    input: UpdateEmergencyContactInput;
    requesterUserId: string;
  }): Promise<EmergencyContact> {
    await this.accessValidator.ensureCaregiver(input.requesterUserId, input.householdId);
    return this.repository.updateEmergencyContact(input.contactId, input.householdId, input.input);
  }
}
