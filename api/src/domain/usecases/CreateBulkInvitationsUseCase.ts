import type { AuthenticatedRequester } from '../entities/Household.js';
import type { BulkInvitationResult, HouseholdRepository, InvitationCandidate } from '../repositories/HouseholdRepository.js';

export class CreateBulkInvitationsUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    requester: AuthenticatedRequester;
    users: InvitationCandidate[];
  }): Promise<BulkInvitationResult> {
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member || member.role !== 'caregiver') {
      throw new Error('Only caregivers can send invitations.');
    }

    return this.repository.createBulkInvitations({
      householdId: input.householdId,
      inviterUserId: input.requester.userId,
      users: input.users,
    });
  }
}
