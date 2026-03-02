import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { MedicationWithReminders } from '../../entities/Medication.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Lists all medications in a household with their reminders.
 * All household members can list medications.
 */
export class ListHouseholdMedicationsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Household identifier with requester info
   * @returns List of medications with reminders in the household
   * @throws {ForbiddenError} If requester is not a member of the household
   */
  async execute(input: {
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<MedicationWithReminders[]> {
    // Validate member access
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Get all medications
    const medications = await this.repository.listHouseholdMedications(input.householdId);

    // For each medication, load its reminders
    const medicationsWithReminders: MedicationWithReminders[] = await Promise.all(
      medications.map(async (medication) => {
        const reminders = await this.repository.listMedicationReminders(
          medication.id,
          input.householdId,
        );
        return {
          ...medication,
          reminders,
        };
      }),
    );

    return medicationsWithReminders;
  }
}
