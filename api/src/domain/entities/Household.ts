export interface Household {
  id: string;
  name: string;
}

export interface HouseholdOverview {
  household: Household;
  membersCount: number;
  seniorsCount: number;
  caregiversCount: number;
}
