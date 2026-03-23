import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';

export class ArchiveSeniorUseCase {
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
      throw new ForbiddenError('Only household members can archive seniors.');
    }

    if (requester.role === 'senior') {
      throw new ForbiddenError('Seniors cannot archive other members.');
    }

    // Verify target member exists in this household
    const target = await this.repository.findMemberInHousehold(input.memberId, input.householdId);
    if (!target) {
      throw new NotFoundError('Member not found in this household.');
    }

    if (target.role !== 'senior') {
      throw new ForbiddenError('Only senior members can be archived.');
    }

    // Revoke all active senior devices first
    await this.repository.revokeAllSeniorDevicesForMember(
      input.memberId,
      input.householdId,
      input.requesterUserId,
    );

    // Archive the member
    await this.repository.archiveMember(input.memberId, input.householdId);
  }
}
