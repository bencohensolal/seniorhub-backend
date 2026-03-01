import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class DeleteReminderUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    reminderId: string;
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Only caregivers can delete reminders
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member || member.role !== 'caregiver') {
      throw new Error('Only caregivers can delete medication reminders.');
    }

    // Verify medication belongs to household
    const medication = await this.repository.getMedicationById(input.medicationId, input.householdId);
    if (!medication) {
      throw new Error('Medication not found.');
    }

    // Verify reminder exists
    const reminder = await this.repository.getReminderById(input.reminderId, input.medicationId, input.householdId);
    if (!reminder) {
      throw new Error('Reminder not found.');
    }

    return this.repository.deleteReminder(input.reminderId, input.medicationId, input.householdId);
  }
}
