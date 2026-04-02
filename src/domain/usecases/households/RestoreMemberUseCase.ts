import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class RestoreMemberUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    memberId: string;
    requesterUserId: string;
  }): Promise<void> {
    const requester = await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    if (!requester) {
      throw new ForbiddenError('Only household members can restore members.');
    }

    // Restore the archived member
    await this.repository.restoreMember(input.memberId, input.householdId);
  }
}
