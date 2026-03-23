import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { EmergencyContact } from '../../entities/EmergencyContact.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class ListEmergencyContactsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }
  async execute(householdId: string, requesterUserId: string): Promise<EmergencyContact[]> {
    await this.accessValidator.ensureMember(requesterUserId, householdId);
    return this.repository.listEmergencyContacts(householdId);
  }
}
