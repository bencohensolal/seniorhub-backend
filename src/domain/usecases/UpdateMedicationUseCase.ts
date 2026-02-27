import type { AuthenticatedRequester } from '../entities/Household.js';
import type { Medication, UpdateMedicationInput } from '../entities/Medication.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class UpdateMedicationUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
    data: UpdateMedicationInput;
  }): Promise<Medication> {
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member || member.role !== 'caregiver') {
      throw new Error('Only caregivers can update medications.');
    }

    return this.repository.updateMedication(input.medicationId, input.householdId, input.data);
  }
}
