import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class ArchiveMemberUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    memberId: string;
    requesterUserId: string;
  }): Promise<void> {
    const requester = await this.accessValidator.ensureMember(input.requesterUserId, input.householdId);

    if (!requester) {
      throw new ForbiddenError('Only household members can archive members.');
    }

    // Cannot archive yourself
    if (requester.id === input.memberId) {
      throw new ForbiddenError('You cannot archive yourself.');
    }

    // Verify target member exists in this household
    const target = await this.repository.findMemberInHousehold(input.memberId, input.householdId);
    if (!target) {
      throw new NotFoundError('Member not found in this household.');
    }

    // Revoke all active senior devices first (only applicable to seniors)
    if (target.role === 'senior') {
      await this.repository.revokeAllSeniorDevicesForMember(
        input.memberId,
        input.householdId,
        input.requesterUserId,
      );
    }

    // Archive the member
    await this.repository.archiveMember(input.memberId, input.householdId);
  }
}

/** @deprecated Use ArchiveMemberUseCase instead */
export const ArchiveSeniorUseCase = ArchiveMemberUseCase;
