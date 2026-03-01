import type { AuthenticatedRequester } from '../entities/Household.js';
import type { Medication, UpdateMedicationInput } from '../entities/Medication.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from './shared/index.js';

/**
 * Updates an existing medication in a household.
 * Only caregivers can update medications.
 */
export class UpdateMedicationUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Medication update data with requester info
   * @returns The updated medication
   * @throws {ForbiddenError} If requester is not a caregiver
   */
  async execute(input: {
    medicationId: string;
    householdId: string;
    requester: AuthenticatedRequester;
    data: UpdateMedicationInput;
  }): Promise<Medication> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    return this.repository.updateMedication(input.medicationId, input.householdId, input.data);
  }
}
