import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { DisplayTabletAuthResult } from '../../entities/DisplayTablet.js';
import { generateDisplayTabletToken, isValidDisplayTabletTokenFormat } from '../../security/displayTabletToken.js';
import { generateTabletSessionToken } from '../../security/displayTabletSession.js';
import { ForbiddenError } from '../../errors/index.js';

const REFRESH_TOKEN_TTL_HOURS = 24 * 30;

export class RefreshDisplayTabletSessionUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    tabletId: string;
    refreshToken: string;
  }): Promise<DisplayTabletAuthResult> {
    if (!isValidDisplayTabletTokenFormat(input.refreshToken)) {
      throw new ForbiddenError('Invalid tablet refresh token format.');
    }

    const nextRefreshToken = generateDisplayTabletToken();
    const nextRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_HOURS * 3600 * 1000).toISOString();

    const basicResult = await this.repository.refreshDisplayTabletSession(
      input.tabletId,
      input.refreshToken,
      nextRefreshToken,
      nextRefreshTokenExpiresAt,
    );

    if (!basicResult) {
      throw new ForbiddenError('Invalid or expired tablet refresh token.');
    }

    const sessionToken = generateTabletSessionToken(input.tabletId, basicResult.householdId);
    const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

    return {
      ...basicResult,
      sessionToken,
      refreshToken: nextRefreshToken,
      expiresAt,
    };
  }
}
