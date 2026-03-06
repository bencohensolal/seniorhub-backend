import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { PhotoScreenWithPhotos } from '../../entities/PhotoScreen.js';
import { NotFoundError, PhotoScreenNotFoundError } from '../../errors/index.js';

export class GetPhotoScreenUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    photoScreenId: string;
    requester: AuthenticatedRequester;
  }): Promise<PhotoScreenWithPhotos> {
    // Verify requester is a member of the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new NotFoundError('Household not found or you are not a member.');
    }

    // Get the photo screen
    const photoScreen = await this.repository.getPhotoScreenById(
      input.photoScreenId,
      input.tabletId,
      input.householdId,
    );

    if (!photoScreen) {
      throw new PhotoScreenNotFoundError('Photo screen not found.');
    }

    return photoScreen;
  }
}
