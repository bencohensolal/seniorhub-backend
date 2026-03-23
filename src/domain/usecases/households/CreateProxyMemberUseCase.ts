import { randomUUID } from 'node:crypto';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { HouseholdRole } from '../../entities/Member.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { ForbiddenError, ValidationError } from '../../errors/index.js';
import { getDefaultHouseholdMemberPermissions } from '../../entities/HouseholdSettings.js';

export class CreateProxyMemberUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
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
