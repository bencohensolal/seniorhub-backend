import type { PrivacySettings, UpdatePrivacySettingsInput } from '../../entities/PrivacySettings.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';

/**
 * Update privacy settings for the authenticated user.
 * Only the user themselves can update their privacy settings.
 */
export class UpdateUserPrivacySettingsUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  /**
   * @param input - User ID and settings to update
   * @returns Updated privacy settings
   */
  async execute(input: {
    userId: string;
    settings: UpdatePrivacySettingsInput;
  }): Promise<PrivacySettings> {
    return await this.repository.updateUserPrivacySettings(input.userId, input.settings);
  }
}
