import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DisplayTabletAuthResult } from '../../entities/DisplayTablet.js';
import { isValidDisplayTabletTokenFormat } from '../../security/displayTabletToken.js';
import { ForbiddenError } from '../../errors/index.js';

export class AuthenticateDisplayTabletUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    tabletId: string;
    token: string;
  }): Promise<DisplayTabletAuthResult> {
    // Validate token format
    if (!isValidDisplayTabletTokenFormat(input.token)) {
      throw new ForbiddenError('Invalid tablet token format.');
    }

    // Authenticate the tablet
    const result = await this.repository.authenticateDisplayTablet(input.tabletId, input.token);

    if (!result) {
      throw new ForbiddenError('Invalid tablet credentials or tablet is not active.');
    }

    return result;
  }
}
