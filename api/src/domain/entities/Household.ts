export interface Household {
  id: string;
  name: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdOverview {
  household: Household;
  membersCount: number;
  seniorsCount: number;
  caregiversCount: number;
}

export interface AuthenticatedRequester {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}
