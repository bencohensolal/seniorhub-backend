import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from './shared/index.js';

/**
 * Deletes a medication from a household.
 * Only caregivers can delete medications.
 */
export class DeleteMedicationUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Medication deletion data with requester info
   * @throws {ForbiddenError} If requester is not a caregiver
   */
  async execute(input: {
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    await this.repository.deleteMedication(input.medicationId, input.householdId);
  }
}
