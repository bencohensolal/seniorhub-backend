import type { AuthenticatedRequester } from '../entities/Household.js';
import type { Medication } from '../entities/Medication.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from './shared/index.js';

/**
 * Lists all medications in a household.
 * All household members can list medications.
 */
export class ListHouseholdMedicationsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Household identifier with requester info
   * @returns List of medications in the household
   * @throws {ForbiddenError} If requester is not a member of the household
   */
  async execute(input: {
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<Medication[]> {
    // Validate member access
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    return this.repository.listHouseholdMedications(input.householdId);
  }
}
