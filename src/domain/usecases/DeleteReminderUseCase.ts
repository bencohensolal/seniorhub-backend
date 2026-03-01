import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from './shared/index.js';
import { NotFoundError } from '../errors/index.js';

/**
 * Deletes a medication reminder from a household.
 * Only caregivers can delete reminders.
 */
export class DeleteReminderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Reminder deletion data with requester info
   * @throws {ForbiddenError} If requester is not a caregiver
   * @throws {NotFoundError} If medication or reminder doesn't exist
   */
  async execute(input: {
    reminderId: string;
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify medication belongs to household
    const medication = await this.repository.getMedicationById(input.medicationId, input.householdId);
    if (!medication) {
      throw new NotFoundError('Medication not found.');
    }

    // Verify reminder exists
    const reminder = await this.repository.getReminderById(input.reminderId, input.medicationId, input.householdId);
    if (!reminder) {
      throw new NotFoundError('Reminder not found.');
    }

    return this.repository.deleteReminder(input.reminderId, input.medicationId, input.householdId);
  }
}
