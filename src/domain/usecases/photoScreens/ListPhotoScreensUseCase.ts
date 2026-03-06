import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { PhotoScreenWithPhotos } from '../../entities/PhotoScreen.js';
import { NotFoundError } from '../../errors/index.js';

export class ListPhotoScreensUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    requester: AuthenticatedRequester;
  }): Promise<PhotoScreenWithPhotos[]> {
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

    // Get all photo screens for the tablet
    const photoScreens = await this.repository.listPhotoScreens(input.tabletId, input.householdId);

    return photoScreens;
  }
}
