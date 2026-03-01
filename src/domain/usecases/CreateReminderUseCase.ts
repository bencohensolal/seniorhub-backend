import type { AuthenticatedRequester } from '../entities/Household.js';
import type { MedicationReminder, CreateReminderInput } from '../entities/MedicationReminder.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from './shared/index.js';
import { NotFoundError } from '../errors/index.js';

/**
 * Creates a new medication reminder in a household.
 * Only caregivers can create reminders.
 */
export class CreateReminderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Reminder creation data with requester info
   * @returns The created reminder
   * @throws {ForbiddenError} If requester is not a caregiver
   * @throws {NotFoundError} If medication doesn't exist
   */
  async execute(input: Omit<CreateReminderInput, 'medicationId'> & {
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<MedicationReminder> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify medication belongs to household
    const medication = await this.repository.getMedicationById(input.medicationId, input.householdId);
    if (!medication) {
      throw new NotFoundError('Medication not found.');
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
