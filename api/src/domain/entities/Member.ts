export type HouseholdRole = 'senior' | 'caregiver' | 'family';

export interface Member {
  id: string;
  householdId: string;
  displayName: string;
  role: HouseholdRole;
}
