import type { AuthenticatedRequester } from '../entities/Household.js';
import type { Medication, CreateMedicationInput } from '../entities/Medication.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class CreateMedicationUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: Omit<CreateMedicationInput, 'createdByUserId'> & { requester: AuthenticatedRequester }): Promise<Medication> {
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member || member.role !== 'caregiver') {
      throw new Error('Only caregivers can create medications.');
    }

    return this.repository.createMedication({
      ...input,
      createdByUserId: input.requester.userId,
    });
  }
}
