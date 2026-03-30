import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { TextScreen } from '../../entities/TextScreen.js';
import { NotFoundError } from '../../errors/index.js';

export class GetTextScreenUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    textScreenId: string;
    requester: AuthenticatedRequester;
  }): Promise<TextScreen> {
    // Verify requester is a member of the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new NotFoundError('Household not found or you are not a member.');
    }

    // Get the text screen
    const textScreen = await this.repository.getTextScreenById(
      input.textScreenId,
      input.tabletId,
      input.householdId,
    );

    if (!textScreen) {
      throw new NotFoundError('Text screen not found.');
    }

    return textScreen;
  }
}
