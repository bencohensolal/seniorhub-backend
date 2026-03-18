import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { StorageService } from '../../../data/services/storage/types.js';
import { GCSStorageService } from '../../../data/services/storage/GCSStorageService.js';
import { NotFoundError, ForbiddenError, PhotoScreenNotFoundError } from '../../errors/index.js';
import { tabletConfigNotifier } from '../../services/tabletConfigNotifier.js';

export class DeletePhotoScreenUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly storageService: StorageService,
  ) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    photoScreenId: string;
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
      throw new ForbiddenError('Only caregivers can delete photo screens.');
    }

    // Verify photo screen exists and get its photos
    const photoScreen = await this.repository.getPhotoScreenById(
      input.photoScreenId,
      input.tabletId,
      input.householdId,
    );

    if (!photoScreen) {
      throw new PhotoScreenNotFoundError('Photo screen not found.');
    }

    // Delete all photos from storage
    for (const photo of photoScreen.photos) {
      const key = GCSStorageService.extractKeyFromUrl(photo.url);
      if (key) {
        try {
          await this.storageService.deletePhoto(key);
        } catch (error) {
          console.error(`Failed to delete photo ${photo.id} from storage:`, error);
          // Continue with deletion even if storage delete fails
        }
      }
    }

    // Delete the photo screen (cascade will delete photo records from DB)
    await this.repository.deletePhotoScreen(
      input.photoScreenId,
      input.tabletId,
      input.householdId,
    );

    // Notify the tablet that its config has been updated
    tabletConfigNotifier.notifyConfigUpdate(input.tabletId, { lastUpdated: new Date().toISOString() });
  }
}
