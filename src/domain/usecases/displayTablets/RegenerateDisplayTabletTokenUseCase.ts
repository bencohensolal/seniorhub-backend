import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DisplayTabletWithToken } from '../../entities/DisplayTablet.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { ForbiddenError } from '../../errors/index.js';

export class RegenerateDisplayTabletTokenUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    tabletId: string;
    requesterUserId: string;
  }): Promise<DisplayTabletWithToken> {
    // Validate household access and role
    const member = await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    // Only caregivers and family can regenerate tokens (not seniors)
    if (member.role === 'senior') {
      throw new ForbiddenError('Seniors cannot regenerate display tablet tokens.');
    }

    // Regenerate the token
    return this.repository.regenerateDisplayTabletToken(input.tabletId, input.householdId);
  }
}
