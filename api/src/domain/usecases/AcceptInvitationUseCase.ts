import type { AuthenticatedRequester } from '../entities/Household.js';
import type { HouseholdRole } from '../entities/Member.js';
import type { HouseholdRepository } from '../repositories/HouseholdRepository.js';

export class AcceptInvitationUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    requester: AuthenticatedRequester;
    token?: string;
    invitationId?: string;
  }): Promise<{ householdId: string; role: HouseholdRole }> {
    const identifier = input.token
      ? { token: input.token }
      : input.invitationId
        ? { invitationId: input.invitationId }
        : {};

    return this.repository.acceptInvitation({
      requester: input.requester,
      ...identifier,
    });
  }
}
