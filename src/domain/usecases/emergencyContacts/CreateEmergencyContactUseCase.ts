import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { EmergencyContact } from '../../entities/EmergencyContact.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { PlanLimitGuard } from '../shared/PlanLimitGuard.js';

export class CreateEmergencyContactUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
    this.planLimitGuard = new PlanLimitGuard(repository);
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

    const existing = await this.repository.listEmergencyContacts(input.householdId);

    // Check plan limit
    await this.planLimitGuard.ensureWithinLimit({
      householdId: input.householdId,
      resource: 'emergency_contacts',
      currentCount: existing.length,
      limitKey: 'maxEmergencyContacts',
    });

    let priorityOrder = input.priorityOrder;
    if (priorityOrder === undefined) {
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
