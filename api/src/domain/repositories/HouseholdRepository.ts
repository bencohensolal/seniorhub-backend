import type { HouseholdOverview } from '../entities/Household.js';
import type { Member } from '../entities/Member.js';

export interface HouseholdRepository {
  getOverviewById(householdId: string): Promise<HouseholdOverview | null>;
  findMemberInHousehold(memberId: string, householdId: string): Promise<Member | null>;
}
