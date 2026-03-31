import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Medication, CreateMedicationInput } from '../../entities/Medication.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { PlanLimitGuard } from '../shared/PlanLimitGuard.js';

/**
 * Creates a new medication for a senior in a household.
 * Only caregivers can create medications.
 */
export class CreateMedicationUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
    this.planLimitGuard = new PlanLimitGuard(repository);
  }

  /**
   * @param input - Medication creation data with requester info
   * @returns The created medication
   * @throws {ForbiddenError} If requester is not a caregiver
   */
  async execute(input: Omit<CreateMedicationInput, 'createdByUserId'> & { requester: AuthenticatedRequester }): Promise<Medication> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Check plan limit: count medications for this specific senior
    const allMedications = await this.repository.listHouseholdMedications(input.householdId);
    const seniorMedicationCount = allMedications.filter((m) => m.seniorId === input.seniorId).length;
    await this.planLimitGuard.ensureWithinLimit({
      householdId: input.householdId,
      resource: 'medications',
      currentCount: seniorMedicationCount,
      limitKey: 'maxMedicationsPerSenior',
    });

    // Extract requester and create medication
    const { requester, ...medicationData } = input;

    return this.repository.createMedication({
      ...medicationData,
      createdByUserId: requester.userId,
    });
  }
}
