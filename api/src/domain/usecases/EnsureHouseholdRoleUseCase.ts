import type { HouseholdRole } from '../entities/Member.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class EnsureHouseholdRoleUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    requesterUserId: string;
    allowedRoles: HouseholdRole[];
  }): Promise<void> {
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requesterUserId,
      input.householdId,
    );

    if (!member) {
      throw new Error('Access denied to this household.');
    }

    if (!input.allowedRoles.includes(member.role)) {
      throw new Error('Insufficient household role.');
    }
  }
}
