import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DisplayTabletWithToken } from '../../entities/DisplayTablet.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { ForbiddenError, ConflictError } from '../../errors/index.js';

const MAX_ACTIVE_TABLETS_PER_HOUSEHOLD = 10;

export class CreateDisplayTabletUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    name: string;
    description?: string;
    requesterUserId: string;
  }): Promise<DisplayTabletWithToken> {
    // Validate household access and role
    const member = await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    // Only caregivers and family can create tablets (not seniors)
    if (member.role === 'senior') {
      throw new ForbiddenError('Seniors cannot create display tablets.');
    }

    // Check if household has reached the maximum number of active tablets
    const activeCount = await this.repository.countActiveDisplayTablets(input.householdId);
    if (activeCount >= MAX_ACTIVE_TABLETS_PER_HOUSEHOLD) {
      throw new ConflictError(
        `Maximum number of active tablets (${MAX_ACTIVE_TABLETS_PER_HOUSEHOLD}) reached for this household.`,
      );
    }

    // Create the tablet
    return this.repository.createDisplayTablet({
      householdId: input.householdId,
      name: input.name,
      description: input.description,
      createdBy: input.requesterUserId,
    });
  }
}
