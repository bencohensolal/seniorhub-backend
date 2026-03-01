import type { AuthenticatedRequester } from '../entities/Household.js';
import type { MedicationReminder } from '../entities/MedicationReminder.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class ListMedicationRemindersUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<MedicationReminder[]> {
    // Verify user is a member of the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new Error('Access denied: not a member of this household.');
    }

    // Verify medication belongs to household
    const medication = await this.repository.getMedicationById(input.medicationId, input.householdId);
    if (!medication) {
      throw new Error('Medication not found.');
    }

    return this.repository.listMedicationReminders(input.medicationId, input.householdId);
  }
}
