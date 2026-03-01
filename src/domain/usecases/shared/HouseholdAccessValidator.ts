import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { Member } from '../../entities/Member.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';

/**
 * Validates household access permissions for authenticated users.
 * Eliminates duplication of access validation logic across UseCases.
 */
export class HouseholdAccessValidator {
  constructor(private readonly repository: HouseholdRepository) {}

  /**
   * Ensures the user is an active member of the household.
   * 
   * @param userId - The user ID to check
   * @param householdId - The household ID to check membership in
   * @returns The member entity if access is granted
   * @throws {ForbiddenError} If user is not a member of the household
   * 
   * @example
   * const member = await validator.ensureMember(userId, householdId);
   */
  async ensureMember(userId: string, householdId: string): Promise<Member> {
    const member = await this.repository.findActiveMemberByUserInHousehold(userId, householdId);
    
    if (!member) {
      throw new ForbiddenError('Access denied to this household.');
    }
    
    return member;
  }

  /**
   * Ensures the user is an active caregiver of the household.
   * 
   * @param userId - The user ID to check
   * @param householdId - The household ID to check membership in
   * @returns The member entity if access is granted
   * @throws {ForbiddenError} If user is not a caregiver of the household
   * 
   * @example
   * const caregiver = await validator.ensureCaregiver(userId, householdId);
   */
  async ensureCaregiver(userId: string, householdId: string): Promise<Member> {
    const member = await this.ensureMember(userId, householdId);
    
    if (member.role !== 'caregiver') {
      throw new ForbiddenError('Only caregivers can perform this action.');
    }
    
    return member;
  }

  /**
   * Ensures the household exists.
   * 
   * @param householdId - The household ID to check
   * @throws {NotFoundError} If household doesn't exist
   * 
   * @example
   * await validator.ensureHouseholdExists(householdId);
   */
  async ensureHouseholdExists(householdId: string): Promise<void> {
    const household = await this.repository.getOverviewById(householdId);
    
    if (!household) {
      throw new NotFoundError('Household not found.');
    }
  }

  /**
   * Ensures a member exists in the household.
   * 
   * @param memberId - The member ID to check
   * @param householdId - The household ID
   * @returns The member entity
   * @throws {NotFoundError} If member doesn't exist in the household
   * 
   * @example
   * const targetMember = await validator.ensureMemberExists(memberId, householdId);
   */
  async ensureMemberExists(memberId: string, householdId: string): Promise<Member> {
    const member = await this.repository.findMemberInHousehold(memberId, householdId);
    
    if (!member) {
      throw new NotFoundError('Member not found in this household.');
    }
    
    return member;
  }
}
