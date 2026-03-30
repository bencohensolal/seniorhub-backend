import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import { NotFoundError, ForbiddenError } from '../../errors/index.js';
import { tabletConfigNotifier } from '../../services/tabletConfigNotifier.js';

export class DeleteTextScreenUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    textScreenId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Verify requester is a caregiver in the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new NotFoundError('Household not found or you are not a member.');
    }

    if (member.role !== 'caregiver') {
      throw new ForbiddenError('Only caregivers can delete text screens.');
    }

    // Verify text screen exists
    const textScreen = await this.repository.getTextScreenById(
      input.textScreenId,
      input.tabletId,
      input.householdId,
    );

    if (!textScreen) {
      throw new NotFoundError('Text screen not found.');
    }

    // Delete the text screen
    await this.repository.deleteTextScreen(
      input.textScreenId,
      input.tabletId,
      input.householdId,
    );

    // Notify the tablet that its config has been updated
    tabletConfigNotifier.notifyConfigUpdate(input.tabletId, { lastUpdated: new Date().toISOString() });
  }
}
