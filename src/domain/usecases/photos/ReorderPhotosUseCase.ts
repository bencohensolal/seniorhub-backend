import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Photo } from '../../entities/PhotoScreen.js';
import { NotFoundError, ForbiddenError, PhotoScreenNotFoundError, ValidationError } from '../../errors/index.js';

export class ReorderPhotosUseCase {
  constructor(private readonly repository: HouseholdRepository) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    photoScreenId: string;
    photoOrders: Array<{ id: string; order: number }>;
    requester: AuthenticatedRequester;
  }): Promise<Photo[]> {
    // Verify requester is a caregiver in the household
    const member = await this.repository.findActiveMemberByUserInHousehold(
      input.requester.userId,
      input.householdId,
    );

    if (!member) {
      throw new NotFoundError('Household not found or you are not a member.');
    }

    if (member.role !== 'caregiver') {
      throw new ForbiddenError('Only caregivers can reorder photos.');
    }

    // Verify photo screen exists
    const photoScreen = await this.repository.getPhotoScreenById(
      input.photoScreenId,
      input.tabletId,
      input.householdId,
    );

    if (!photoScreen) {
      throw new PhotoScreenNotFoundError('Photo screen not found.');
    }

    // Validate that all photo IDs exist in the screen
    const existingPhotoIds = new Set(photoScreen.photos.map(p => p.id));
    const requestedPhotoIds = new Set(input.photoOrders.map(p => p.id));

    for (const requestedId of requestedPhotoIds) {
      if (!existingPhotoIds.has(requestedId)) {
        throw new ValidationError(`Photo ${requestedId} not found in this photo screen.`);
      }
    }

    // Validate that all photos are included
    if (requestedPhotoIds.size !== existingPhotoIds.size) {
      throw new ValidationError('All photos must be included in the reorder operation.');
    }

    // Reorder photos
    const reorderedPhotos = await this.repository.reorderPhotos(
      input.photoScreenId,
      input.householdId,
      input.photoOrders,
    );

    return reorderedPhotos;
  }
}
