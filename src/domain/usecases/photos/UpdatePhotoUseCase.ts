import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Photo, UpdatePhotoInput } from '../../entities/PhotoScreen.js';
import { NotFoundError, ForbiddenError, PhotoNotFoundError } from '../../errors/index.js';
import { tabletConfigNotifier } from '../../services/tabletConfigNotifier.js';

export class UpdatePhotoUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    photoScreenId: string;
    photoId: string;
    caption?: string | null;
    order?: number;
    requester: AuthenticatedRequester;
  }): Promise<Photo> {
    // Verify requester is a caregiver in the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new NotFoundError('Household not found or you are not a member.');
    }

    if (member.role !== 'caregiver') {
      throw new ForbiddenError('Only caregivers can update photos.');
    }

    // Verify photo exists
    const existingPhoto = await this.repository.getPhotoById(
      input.photoId,
      input.photoScreenId,
      input.householdId,
    );

    if (!existingPhoto) {
      throw new PhotoNotFoundError('Photo not found.');
    }

    // Update the photo - only include defined properties
    const updateInput: UpdatePhotoInput = {};
    if (input.caption !== undefined) updateInput.caption = input.caption;
    if (input.order !== undefined) updateInput.order = input.order;

    const updatedPhoto = await this.repository.updatePhoto(
      input.photoId,
      input.photoScreenId,
      input.householdId,
      updateInput,
    );

    // Notify the tablet that its config has been updated
    tabletConfigNotifier.notifyConfigUpdate(input.tabletId, { lastUpdated: new Date().toISOString() });

    return updatedPhoto;
  }
}
