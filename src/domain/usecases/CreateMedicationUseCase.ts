import type { AuthenticatedRequester } from '../entities/Household.js';
import type { Medication, CreateMedicationInput } from '../entities/Medication.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from './shared/index.js';

/**
 * Creates a new medication for a senior in a household.
 * Only caregivers can create medications.
 */
export class CreateMedicationUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Medication creation data with requester info
   * @returns The created medication
   * @throws {ForbiddenError} If requester is not a caregiver
   */
  async execute(input: Omit<CreateMedicationInput, 'createdByUserId'> & { requester: AuthenticatedRequester }): Promise<Medication> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Extract requester and create medication
    const { requester, ...medicationData } = input;

    return this.repository.createMedication({
      ...medicationData,
      createdByUserId: requester.userId,
    });
  }
}
