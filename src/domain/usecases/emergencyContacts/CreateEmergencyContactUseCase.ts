import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { EmergencyContact } from '../../entities/EmergencyContact.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class CreateEmergencyContactUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }
  async execute(input: {
    householdId: string;
    name: string;
    phone: string;
    relationship?: string;
    priorityOrder?: number;
    requesterUserId: string;
  }): Promise<EmergencyContact> {
    await this.accessValidator.ensureCaregiver(input.requesterUserId, input.householdId);

    let priorityOrder = input.priorityOrder;
    if (priorityOrder === undefined) {
      const existing = await this.repository.listEmergencyContacts(input.householdId);
      priorityOrder = existing.length;
    }

    return this.repository.createEmergencyContact({
      householdId: input.householdId,
      name: input.name,
      phone: input.phone,
      ...(input.relationship !== undefined && { relationship: input.relationship }),
      priorityOrder,
    });
  }
}
