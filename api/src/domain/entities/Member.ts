export type HouseholdRole = 'senior' | 'caregiver';
export type HouseholdMemberStatus = 'active' | 'pending';

export interface Member {
  id: string;
  householdId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  joinedAt: string;
  createdAt: string;
}
