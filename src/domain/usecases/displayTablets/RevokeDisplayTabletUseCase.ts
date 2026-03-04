import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class RevokeDisplayTabletUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    tabletId: string;
    requesterUserId: string;
  }): Promise<void> {
    // Validate household access
    await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    // Revoke the tablet
    await this.repository.revokeDisplayTablet(
      input.tabletId,
      input.householdId,
      input.requesterUserId,
    );
  }
}
