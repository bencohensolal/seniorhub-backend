import type { PrivacySettings } from '../../entities/PrivacySettings.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';

/**
 * Get privacy settings for the authenticated user.
 * Returns default settings if none exist yet.
 */
export class GetUserPrivacySettingsUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  /**
   * @param input - User ID to fetch settings for
   * @returns Privacy settings with defaults if not yet configured
   */
  async execute(input: { userId: string }): Promise<PrivacySettings> {
    const settings = await this.repository.getUserPrivacySettings(input.userId);

    // If settings don't exist yet, return defaults
    if (!settings) {
      return {
        id: '', // Will be generated on first save
        userId: input.userId,
        shareProfile: true,
        shareActivityHistory: true,
        allowAnalytics: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return settings;
  }
}
