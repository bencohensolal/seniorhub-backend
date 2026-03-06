import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { StorageService } from '../../../data/services/storage/types.js';
import { S3StorageService } from '../../../data/services/storage/S3StorageService.js';
import { NotFoundError, ForbiddenError, PhotoNotFoundError } from '../../errors/index.js';

export class DeletePhotoUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly storageService: StorageService,
  ) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    photoScreenId: string;
    photoId: string;
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
      throw new ForbiddenError('Only caregivers can delete photos.');
    }

    // Verify photo exists
    const photo = await this.repository.getPhotoById(
      input.photoId,
      input.photoScreenId,
      input.householdId,
    );

    if (!photo) {
      throw new PhotoNotFoundError('Photo not found.');
    }

    // Delete from S3
    const key = S3StorageService.extractKeyFromUrl(photo.url);
    if (key) {
      try {
        await this.storageService.deletePhoto(key);
      } catch (error) {
        console.error(`Failed to delete photo ${photo.id} from S3:`, error);
        // Continue with database deletion even if S3 delete fails
      }
    }

    // Delete from database
    await this.repository.deletePhoto(
      input.photoId,
      input.photoScreenId,
      input.householdId,
    );
  }
}
