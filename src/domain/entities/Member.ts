export type HouseholdRole = 'senior' | 'caregiver' | 'family' | 'intervenant';
export type HouseholdMemberStatus = 'active' | 'pending' | 'archived';
export type AuthProvider = 'google' | 'device' | 'phone' | 'apple';

export interface Member {
  id: string;
  householdId: string;
  userId: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  joinedAt: string;
  createdAt: string;
  authProvider: AuthProvider;
  phoneNumber: string | null;
}
