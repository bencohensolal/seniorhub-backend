// Storage service types

export interface UploadPhotoResult {
  url: string;
  key: string;
}

export interface PhotoUploadInput {
  buffer: Buffer;
  mimeType: string;
  householdId: string;
  tabletId: string;
  photoId: string;
}

export interface StorageService {
  uploadPhoto(input: PhotoUploadInput): Promise<UploadPhotoResult>;
  deletePhoto(key: string): Promise<void>;
  deletePhotosByPrefix(prefix: string): Promise<void>;
}
