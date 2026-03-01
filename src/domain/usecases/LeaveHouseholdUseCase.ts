import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../entities/Household.js';
import { HouseholdAccessValidator } from './shared/index.js';
import { BusinessRuleError } from '../errors/index.js';

export interface LeaveHouseholdInput {
  householdId: string;
  requester: AuthenticatedRequester;
}

/**
 * Allows a member to leave a household.
 * Business rules: Cannot leave if last member, cannot leave if last caregiver.
 */
export class LeaveHouseholdUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Leave household data with requester info
   * @throws {ForbiddenError} If requester is not a member
   * @throws {BusinessRuleError} If trying to leave as last member or last caregiver
   */
  async execute(input: LeaveHouseholdInput): Promise<void> {
    // Validate member access
    const requesterMembership = await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    const allMembers = await this.repository.listHouseholdMembers(input.householdId);

    // Cannot leave if last member
    if (allMembers.length <= 1) {
      throw new BusinessRuleError('Cannot leave household. You are the last member.');
    }

    // Cannot leave if last caregiver
    if (requesterMembership.role === 'caregiver') {
      const caregiverCount = allMembers.filter((m) => m.role === 'caregiver').length;
      if (caregiverCount <= 1) {
        throw new BusinessRuleError('Cannot leave household. You are the last caregiver.');
      }
    }

    // Remove the member
    await this.repository.removeMember(requesterMembership.id);
  }
}
