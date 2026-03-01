import type { AuthenticatedRequester } from '../entities/Household.js';
import type { MedicationReminder, UpdateReminderInput } from '../entities/MedicationReminder.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class UpdateReminderUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    reminderId: string;
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
    data: UpdateReminderInput;
  }): Promise<MedicationReminder> {
    // Only caregivers can update reminders
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member || member.role !== 'caregiver') {
      throw new Error('Only caregivers can update medication reminders.');
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

    return this.repository.updateReminder(
      input.reminderId,
      input.medicationId,
      input.householdId,
      input.data,
    );
  }
}
