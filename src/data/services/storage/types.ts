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

export interface UploadDocumentResult {
  url: string;
  key: string;
  signedUrl: string; // For immediate download after upload
}

export interface DocumentUploadInput {
  buffer: Buffer;
  mimeType: string;
  householdId: string;
  documentId: string;
  originalFilename: string;
  extension: string;
}

export interface StorageService {
  uploadPhoto(input: PhotoUploadInput): Promise<UploadPhotoResult>;
  deletePhoto(key: string): Promise<void>;
  deletePhotosByPrefix(prefix: string): Promise<void>;

  // Document operations
  uploadDocument(input: DocumentUploadInput): Promise<UploadDocumentResult>;
  deleteDocument(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}
