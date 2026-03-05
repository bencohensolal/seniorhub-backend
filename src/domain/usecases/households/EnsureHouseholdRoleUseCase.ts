import type { HouseholdRole } from '../../entities/Member.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { ForbiddenError } from '../../errors/DomainErrors.js';

export class EnsureHouseholdRoleUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    requesterUserId: string;
    allowedRoles: HouseholdRole[];
  }): Promise<void> {
    const member = await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    // Tablets don't have roles
    if (!member) {
      throw new ForbiddenError('Insufficient household role.');
    }

    if (!input.allowedRoles.includes(member.role)) {
      throw new ForbiddenError('Insufficient household role.');
    }
  }
}
