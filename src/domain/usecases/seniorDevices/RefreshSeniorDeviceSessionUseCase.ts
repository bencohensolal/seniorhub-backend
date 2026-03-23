import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { SeniorDeviceAuthResult } from '../../entities/SeniorDevice.js';
import { generateDisplayTabletToken, isValidDisplayTabletTokenFormat } from '../../security/displayTabletToken.js';
import { generateSeniorDeviceSessionToken } from '../../security/seniorDeviceSession.js';
import { ForbiddenError } from '../../errors/index.js';

const REFRESH_TOKEN_TTL_HOURS = 24 * 90; // 90 days

export class RefreshSeniorDeviceSessionUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    deviceId: string;
    refreshToken: string;
  }): Promise<SeniorDeviceAuthResult> {
    if (!isValidDisplayTabletTokenFormat(input.refreshToken)) {
      throw new ForbiddenError('Invalid device refresh token format.');
    }

    const nextRefreshToken = generateDisplayTabletToken();
    const nextRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_HOURS * 3600 * 1000).toISOString();

    const basicResult = await this.repository.refreshSeniorDeviceSession(
      input.deviceId,
      input.refreshToken,
      nextRefreshToken,
      nextRefreshTokenExpiresAt,
    );

    if (!basicResult) {
      throw new ForbiddenError('Invalid or expired device refresh token.');
    }

    const sessionToken = generateSeniorDeviceSessionToken(
      input.deviceId,
      basicResult.householdId,
      basicResult.memberId,
      basicResult.userId,
      basicResult.role,
    );

    const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    return {
      ...basicResult,
      sessionToken,
      refreshToken: nextRefreshToken,
      expiresAt,
    };
  }
}
