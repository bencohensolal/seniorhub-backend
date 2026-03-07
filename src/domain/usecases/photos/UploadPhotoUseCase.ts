import { randomUUID } from 'node:crypto';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { StorageService } from '../../../data/services/storage/types.js';
import type { Photo, CreatePhotoInput } from '../../entities/PhotoScreen.js';
import { MAX_PHOTOS_PER_SCREEN, MAX_PHOTO_SIZE_MB } from '../../entities/PhotoScreen.js';
import {
  NotFoundError,
  ForbiddenError,
  PhotoScreenNotFoundError,
  MaxPhotosReachedError,
  UnsupportedFileFormatError,
  FileTooLargeError,
} from '../../errors/index.js';
import { tabletConfigNotifier } from '../../services/tabletConfigNotifier.js';

const SUPPORTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;

export class UploadPhotoUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly storageService: StorageService,
  ) {}

  async execute(input: {
    householdId: string;
    tabletId: string;
    photoScreenId: string;
    fileBuffer: Buffer;
    mimeType: string;
    caption?: string;
    order: number;
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
      throw new ForbiddenError('Only caregivers can upload photos.');
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

    // Check max photos limit
    const existingCount = await this.repository.countPhotos(input.photoScreenId);
    
    if (existingCount >= MAX_PHOTOS_PER_SCREEN) {
      throw new MaxPhotosReachedError(
        `This photo screen has already reached the limit of ${MAX_PHOTOS_PER_SCREEN} photos.`,
      );
    }

    // Validate file format
    if (!SUPPORTED_MIME_TYPES.includes(input.mimeType)) {
      throw new UnsupportedFileFormatError(
        `Unsupported file format. Supported formats: JPEG, PNG, WebP.`,
      );
    }

    // Validate file size
    if (input.fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new FileTooLargeError(
        `File size exceeds the maximum allowed size of ${MAX_PHOTO_SIZE_MB}MB.`,
      );
    }

    // Generate photo ID
    const photoId = randomUUID();

    // Upload to S3 (processing happens in the storage service)
    const { url } = await this.storageService.uploadPhoto({
      buffer: input.fileBuffer,
      mimeType: input.mimeType,
      householdId: input.householdId,
      tabletId: input.tabletId,
      photoId,
    });

    // Create photo record in database
    const createInput: CreatePhotoInput = {
      photoScreenId: input.photoScreenId,
      url,
      caption: input.caption ?? null,
      order: input.order,
    };

    const photo = await this.repository.createPhoto(createInput);

    // Notify the tablet that its config has been updated
    tabletConfigNotifier.notifyConfigUpdate(input.tabletId, { lastUpdated: new Date().toISOString() });

    return photo;
  }
}
