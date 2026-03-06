import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { CreatePhotoScreenInput, PhotoScreen } from '../../entities/PhotoScreen.js';
import { MAX_PHOTO_SCREENS_PER_TABLET } from '../../entities/PhotoScreen.js';
import { NotFoundError, ForbiddenError, MaxPhotoScreensReachedError } from '../../errors/index.js';

export class CreatePhotoScreenUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    name: string;
    displayMode?: 'slideshow' | 'mosaic' | 'single';
    slideshowDuration?: number;
    slideshowTransition?: 'fade' | 'slide' | 'none';
    slideshowOrder?: 'sequential' | 'random';
    showCaptions?: boolean;
    requester: AuthenticatedRequester;
  }): Promise<PhotoScreen> {
    // Verify requester is a caregiver in the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new NotFoundError('Household not found or you are not a member.');
    }

    if (member.role !== 'caregiver') {
      throw new ForbiddenError('Only caregivers can create photo screens.');
    }

    // Verify tablet exists and belongs to the household
    const tablet = await this.repository.getDisplayTabletById(input.tabletId, input.householdId);
    
    if (!tablet) {
      throw new NotFoundError('Display tablet not found.');
    }

    // Check if max photo screens limit is reached
    const existingCount = await this.repository.countPhotoScreens(input.tabletId, input.householdId);
    
    if (existingCount >= MAX_PHOTO_SCREENS_PER_TABLET) {
      throw new MaxPhotoScreensReachedError(
        `This tablet has already reached the limit of ${MAX_PHOTO_SCREENS_PER_TABLET} photo screens.`,
      );
    }

    // Create the photo screen with defaults
    const createInput: CreatePhotoScreenInput = {
      tabletId: input.tabletId,
      householdId: input.householdId,
      name: input.name,
      createdBy: input.requester.userId,
      ...(input.displayMode !== undefined && { displayMode: input.displayMode }),
      ...(input.slideshowDuration !== undefined && { slideshowDuration: input.slideshowDuration }),
      ...(input.slideshowTransition !== undefined && { slideshowTransition: input.slideshowTransition }),
      ...(input.slideshowOrder !== undefined && { slideshowOrder: input.slideshowOrder }),
      ...(input.showCaptions !== undefined && { showCaptions: input.showCaptions }),
    };

    const photoScreen = await this.repository.createPhotoScreen(createInput);

    return photoScreen;
  }
}
