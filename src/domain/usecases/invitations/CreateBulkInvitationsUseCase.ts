import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { BulkInvitationResult, HouseholdRepository, InvitationCandidate } from '../../repositories/HouseholdRepository.js';
import { ForbiddenError } from '../../errors/index.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { PlanLimitGuard } from '../shared/PlanLimitGuard.js';

/** Roles that count toward maxCaregivers */
const CAREGIVER_ROLES = new Set(['caregiver', 'family', 'intervenant']);

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

    // Count existing active members by role bucket
    const currentMembers = await this.repository.listHouseholdMembers(input.householdId);
    const activeMembers = currentMembers.filter((m) => m.status === 'active');
    const currentSeniorCount = activeMembers.filter((m) => m.role === 'senior').length;
    const currentCaregiverCount = activeMembers.filter((m) => CAREGIVER_ROLES.has(m.role)).length;

    // Count how many of each role we're about to invite
    const invitedSeniorCount = input.users.filter((u) => u.role === 'senior').length;
    const invitedCaregiverCount = input.users.filter((u) => CAREGIVER_ROLES.has(u.role)).length;

    // Check senior limit if any senior is being invited
    if (invitedSeniorCount > 0) {
      await this.planLimitGuard.ensureWithinLimit({
        householdId: input.householdId,
        resource: 'seniors',
        currentCount: currentSeniorCount + invitedSeniorCount - 1,
        limitKey: 'maxSeniors',
      });
    }

    // Check caregiver limit if any non-senior is being invited
    if (invitedCaregiverCount > 0) {
      await this.planLimitGuard.ensureWithinLimit({
        householdId: input.householdId,
        resource: 'caregivers',
        currentCount: currentCaregiverCount + invitedCaregiverCount - 1,
        limitKey: 'maxCaregivers',
      });
    }

    return this.repository.createBulkInvitations({
      householdId: input.householdId,
      inviterUserId: input.requester.userId,
      users: input.users,
    });
  }
}
