import type { AuthenticatedRequester } from '../entities/Household.js';
import type { MedicationReminder } from '../entities/MedicationReminder.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from './shared/index.js';
import { NotFoundError } from '../errors/index.js';

/**
 * Lists all reminders for a specific medication in a household.
 * All household members can list reminders.
 */
export class ListMedicationRemindersUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Medication and household identifiers with requester info
   * @returns List of reminders for the medication
   * @throws {ForbiddenError} If requester is not a member of the household
   * @throws {NotFoundError} If medication doesn't exist
   */
  async execute(input: {
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<MedicationReminder[]> {
    // Validate member access
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Verify medication belongs to household
    const medication = await this.repository.getMedicationById(input.medicationId, input.householdId);
    if (!medication) {
      throw new NotFoundError('Medication not found.');
    }

    return this.repository.listMedicationReminders(input.medicationId, input.householdId);
  }
}
