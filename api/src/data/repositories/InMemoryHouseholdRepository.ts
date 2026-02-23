import type { HouseholdOverview } from '../../domain/entities/Household.js';
import type { Member } from '../../domain/entities/Member.js';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';

const OVERVIEWS: HouseholdOverview[] = [
  {
    household: { id: 'household-1', name: 'Martin Family Home' },
    membersCount: 4,
    seniorsCount: 1,
    caregiversCount: 1,
  },
];

const MEMBERS: Member[] = [
  { id: 'member-1', householdId: 'household-1', displayName: 'Alice Martin', role: 'senior' },
  { id: 'member-2', householdId: 'household-1', displayName: 'Ben Martin', role: 'caregiver' },
  { id: 'member-3', householdId: 'household-1', displayName: 'Claire Martin', role: 'family' },
];

export class InMemoryHouseholdRepository implements HouseholdRepository {
  async getOverviewById(householdId: string): Promise<HouseholdOverview | null> {
    return OVERVIEWS.find((item) => item.household.id === householdId) ?? null;
  }

  async findMemberInHousehold(memberId: string, householdId: string): Promise<Member | null> {
    return MEMBERS.find((member) => member.id === memberId && member.householdId === householdId) ?? null;
  }
}
