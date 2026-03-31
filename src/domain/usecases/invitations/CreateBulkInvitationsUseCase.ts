import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { BulkInvitationResult, HouseholdRepository, InvitationCandidate } from '../../repositories/HouseholdRepository.js';
import { ForbiddenError } from '../../errors/index.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { PlanLimitGuard } from '../shared/PlanLimitGuard.js';

/**
 * Creates multiple invitations in bulk for a household.
 * Only caregivers can send invitations.
 */
export class CreateBulkInvitationsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
    this.planLimitGuard = new PlanLimitGuard(repository);
  }

  /**
   * @param input - Bulk invitation data with requester info
   * @returns Result with successful and failed invitations
   * @throws {ForbiddenError} If requester is not a caregiver
   */
  async execute(input: {
    householdId: string;
    requester: AuthenticatedRequester;
    users: InvitationCandidate[];
  }): Promise<BulkInvitationResult> {
    // Validate caregiver access
    try {
      await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        throw new ForbiddenError('Only caregivers can send invitations.');
      }

      throw error;
    }

    // Check plan limit: ensure at least one more member slot is available
    const currentMembers = await this.repository.listHouseholdMembers(input.householdId);
    await this.planLimitGuard.ensureWithinLimit({
      householdId: input.householdId,
      resource: 'members',
      currentCount: currentMembers.length,
      limitKey: 'maxMembers',
    });

    return this.repository.createBulkInvitations({
      householdId: input.householdId,
      inviterUserId: input.requester.userId,
      users: input.users,
    });
  }
}
