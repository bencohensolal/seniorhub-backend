/**
 * User Privacy Settings
 * 
 * Controls how a user's data is shared with other household members.
 */
export interface PrivacySettings {
  id: string;
  userId: string;
  shareProfile: boolean;
  shareActivityHistory: boolean;
  allowAnalytics: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePrivacySettingsInput {
  shareProfile?: boolean;
  shareActivityHistory?: boolean;
  allowAnalytics?: boolean;
}

/**
 * Anonymized user info for display when shareProfile is disabled
 */
export interface AnonymizedUserInfo {
  userId: string;
  email: string;
  firstName: string; // Will be "User"
  lastName: string; // Will be "User"
}
