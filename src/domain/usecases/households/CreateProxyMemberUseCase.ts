import { randomUUID } from 'node:crypto';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { HouseholdRole } from '../../entities/Member.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { PlanLimitGuard } from '../shared/PlanLimitGuard.js';
import { ForbiddenError, ValidationError } from '../../errors/index.js';
import { getDefaultHouseholdMemberPermissions } from '../../entities/HouseholdSettings.js';

export class CreateProxyMemberUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
    this.planLimitGuard = new PlanLimitGuard(repository);
  }

  async execute(input: {
    householdId: string;
    firstName: string;
    lastName: string;
    role: HouseholdRole;
    phoneNumber?: string | undefined;
    requesterUserId: string;
  }): Promise<{ memberId: string }> {
    const member = await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    if (!member) {
      throw new ForbiddenError('Tablets cannot create proxy members.');
    }

    if (member.role === 'senior') {
      throw new ForbiddenError('Seniors cannot create proxy members.');
    }

    if (!input.firstName.trim() || !input.lastName.trim()) {
      throw new ValidationError('First name and last name are required.');
    }

    // Check plan limit for household members
    const members = await this.repository.listHouseholdMembers(input.householdId);
    const activeMembers = members.filter((m) => m.status === 'active');
    await this.planLimitGuard.ensureWithinLimit({
      householdId: input.householdId,
      resource: 'members',
      currentCount: activeMembers.length,
      limitKey: 'maxMembers',
    });

    const userId = `proxy_${randomUUID()}`;
    const permissions = getDefaultHouseholdMemberPermissions(input.role);

    const result = await this.repository.createProxyMember({
      householdId: input.householdId,
      userId,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      phoneNumber: input.phoneNumber,
      permissions,
    });

    return { memberId: result.id };
  }
}
