import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { TextScreen } from '../../entities/TextScreen.js';
import { NotFoundError } from '../../errors/index.js';

export class ListTextScreensUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    requester: AuthenticatedRequester;
  }): Promise<TextScreen[]> {
    // Verify requester is a member of the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new NotFoundError('Household not found or you are not a member.');
    }

    // Verify tablet exists
    const tablet = await this.repository.getDisplayTabletById(input.tabletId, input.householdId);

    if (!tablet) {
      throw new NotFoundError('Display tablet not found.');
    }

    // Get all text screens for the tablet
    const textScreens = await this.repository.listTextScreens(input.tabletId, input.householdId);

    return textScreens;
  }
}
