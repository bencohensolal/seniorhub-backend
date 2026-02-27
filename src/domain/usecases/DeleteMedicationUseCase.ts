import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class DeleteMedicationUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member || member.role !== 'caregiver') {
      throw new Error('Only caregivers can delete medications.');
    }

    await this.repository.deleteMedication(input.medicationId, input.householdId);
  }
}
