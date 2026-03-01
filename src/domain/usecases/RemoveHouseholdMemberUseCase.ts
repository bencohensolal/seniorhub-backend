import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../entities/Household.js';
import { HouseholdAccessValidator } from './shared/index.js';
import { NotFoundError, ConflictError, BusinessRuleError } from '../errors/index.js';

export interface RemoveHouseholdMemberInput {
  householdId: string;
  memberId: string;
  requester: AuthenticatedRequester;
}

/**
 * Removes a member from a household.
 * Only caregivers can remove members.
 * Business rules: Cannot remove self, cannot remove last member.
 */
export class RemoveHouseholdMemberUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Member removal data with requester info
   * @throws {ForbiddenError} If requester is not a caregiver
   * @throws {NotFoundError} If target member doesn't exist
   * @throws {ConflictError} If trying to remove self
   * @throws {BusinessRuleError} If trying to remove last member
   */
  async execute(input: RemoveHouseholdMemberInput): Promise<void> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify target member exists in household
    const targetMember = await this.repository.findMemberById(input.memberId);
    if (!targetMember || targetMember.householdId !== input.householdId) {
      throw new NotFoundError('Member not found in this household.');
    }

    // Cannot remove self using this endpoint
    if (targetMember.userId === input.requester.userId) {
      throw new ConflictError('Cannot remove yourself using this endpoint. Use leave household instead.');
    }

    // Check if target is the last member
    const allMembers = await this.repository.listHouseholdMembers(input.householdId);
    if (allMembers.length <= 1) {
      throw new BusinessRuleError('Cannot remove the last member of the household.');
    }

    // Remove the member
    await this.repository.removeMember(input.memberId);
  }
}
