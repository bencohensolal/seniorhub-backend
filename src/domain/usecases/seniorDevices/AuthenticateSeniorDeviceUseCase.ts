import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { SeniorDeviceAuthResult } from '../../entities/SeniorDevice.js';
import { generateDisplayTabletToken, isValidDisplayTabletTokenFormat } from '../../security/displayTabletToken.js';
import { generateSeniorDeviceSessionToken } from '../../security/seniorDeviceSession.js';
import { ForbiddenError } from '../../errors/index.js';

const REFRESH_TOKEN_TTL_HOURS = 24 * 90; // 90 days

export class AuthenticateSeniorDeviceUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    deviceId: string;
    setupToken: string;
  }): Promise<SeniorDeviceAuthResult> {
    if (!isValidDisplayTabletTokenFormat(input.setupToken)) {
      throw new ForbiddenError('Invalid device setup token format.');
    }

    const refreshToken = generateDisplayTabletToken();
    const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_HOURS * 3600 * 1000).toISOString();

    const basicResult = await this.repository.authenticateSeniorDevice(
      input.deviceId,
      input.setupToken,
      refreshToken,
      refreshTokenExpiresAt,
    );

    if (!basicResult) {
      throw new ForbiddenError('Invalid, expired, or already-used device setup token.');
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
      refreshToken,
      expiresAt,
    };
  }
}
