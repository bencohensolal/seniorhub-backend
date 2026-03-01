import type { AuthenticatedRequester } from '../entities/Household.js';
import type { BulkInvitationResult, HouseholdRepository, InvitationCandidate } from '../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from './shared/index.js';

/**
 * Creates multiple invitations in bulk for a household.
 * Only caregivers can send invitations.
 */
export class CreateBulkInvitationsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
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
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    return this.repository.createBulkInvitations({
      householdId: input.householdId,
      inviterUserId: input.requester.userId,
      users: input.users,
    });
  }
}
