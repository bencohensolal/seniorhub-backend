import type { AuthenticatedRequester } from '../entities/Household.js';
import type { MedicationReminder, CreateReminderInput } from '../entities/MedicationReminder.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class CreateReminderUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: Omit<CreateReminderInput, 'medicationId'> & {
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<MedicationReminder> {
    // Only caregivers can create reminders
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member || member.role !== 'caregiver') {
      throw new Error('Only caregivers can create medication reminders.');
    }

    // Verify medication belongs to household
    const medication = await this.repository.getMedicationById(input.medicationId, input.householdId);
    if (!medication) {
      throw new Error('Medication not found.');
    }

    const reminderInput: CreateReminderInput = {
      medicationId: input.medicationId,
      time: input.time,
      daysOfWeek: input.daysOfWeek,
    };

    if (input.enabled !== undefined) {
      reminderInput.enabled = input.enabled;
    }

    return this.repository.createReminder(reminderInput);
  }
}
