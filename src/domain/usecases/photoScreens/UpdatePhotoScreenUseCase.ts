import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { UpdatePhotoScreenInput, PhotoScreen } from '../../entities/PhotoScreen.js';
import { NotFoundError, ForbiddenError, PhotoScreenNotFoundError } from '../../errors/index.js';
import { tabletConfigNotifier } from '../../services/tabletConfigNotifier.js';

export class UpdatePhotoScreenUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    photoScreenId: string;
    name?: string;
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
      throw new ForbiddenError('Only caregivers can update photo screens.');
    }

    // Verify photo screen exists
    const existingScreen = await this.repository.getPhotoScreenById(
      input.photoScreenId,
      input.tabletId,
      input.householdId,
    );

    if (!existingScreen) {
      throw new PhotoScreenNotFoundError('Photo screen not found.');
    }

    // Update the photo screen - only include defined properties
    const updateInput: UpdatePhotoScreenInput = {};
    if (input.name !== undefined) updateInput.name = input.name;
    if (input.displayMode !== undefined) updateInput.displayMode = input.displayMode;
    if (input.slideshowDuration !== undefined) updateInput.slideshowDuration = input.slideshowDuration;
    if (input.slideshowTransition !== undefined) updateInput.slideshowTransition = input.slideshowTransition;
    if (input.slideshowOrder !== undefined) updateInput.slideshowOrder = input.slideshowOrder;
    if (input.showCaptions !== undefined) updateInput.showCaptions = input.showCaptions;

    const updatedScreen = await this.repository.updatePhotoScreen(
      input.photoScreenId,
      input.tabletId,
      input.householdId,
      updateInput,
    );

    // Notify the tablet that its config has been updated
    tabletConfigNotifier.notifyConfigUpdate(input.tabletId, { lastUpdated: new Date().toISOString() });

    return updatedScreen;
  }
}
