import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRole, Member } from '../entities/Member.js';
import { HouseholdAccessValidator } from './shared/index.js';
import { NotFoundError, BusinessRuleError } from '../errors/index.js';

export interface UpdateHouseholdMemberRoleInput {
  householdId: string;
  memberId: string;
  newRole: HouseholdRole;
  requester: AuthenticatedRequester;
}

/**
 * Updates a member's role in a household.
 * Only caregivers can update roles.
 * Business rule: Household must always have at least one caregiver.
 */
export class UpdateHouseholdMemberRoleUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Member role update data with requester info
   * @returns The updated member
   * @throws {ForbiddenError} If requester is not a caregiver
   * @throws {NotFoundError} If target member doesn't exist
   * @throws {BusinessRuleError} If trying to demote last caregiver
   */
  async execute(input: UpdateHouseholdMemberRoleInput): Promise<Member> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify target member exists in household
    const targetMember = await this.repository.findMemberById(input.memberId);
    if (!targetMember || targetMember.householdId !== input.householdId) {
      throw new NotFoundError('Member not found in this household.');
    }

    // If demoting from caregiver, check if there's at least one other caregiver
    if (targetMember.role === 'caregiver' && input.newRole !== 'caregiver') {
      const allMembers = await this.repository.listHouseholdMembers(input.householdId);
      const caregiverCount = allMembers.filter((m) => m.role === 'caregiver').length;

      if (caregiverCount <= 1) {
        throw new BusinessRuleError('Cannot demote yourself. The household must have at least one caregiver.');
      }
    }

    // Update the role
    const updatedMember = await this.repository.updateMemberRole(input.memberId, input.newRole);
    return updatedMember;
  }
}
