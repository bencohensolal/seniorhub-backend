import type { AuthenticatedRequester } from '../entities/Household.js';
import type { MedicationReminder, UpdateReminderInput } from '../entities/MedicationReminder.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from './shared/index.js';
import { NotFoundError } from '../errors/index.js';

/**
 * Updates an existing medication reminder in a household.
 * Only caregivers can update reminders.
 */
export class UpdateReminderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Reminder update data with requester info
   * @returns The updated reminder
   * @throws {ForbiddenError} If requester is not a caregiver
   * @throws {NotFoundError} If medication or reminder doesn't exist
   */
  async execute(input: {
    reminderId: string;
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
    data: UpdateReminderInput;
  }): Promise<MedicationReminder> {
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

    return this.repository.updateReminder(
      input.reminderId,
      input.medicationId,
      input.householdId,
      input.data,
    );
  }
}
