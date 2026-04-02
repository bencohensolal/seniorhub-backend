import { GCSStorageService } from './GCSStorageService.js';
import type { StorageService } from './types.js';
import { env } from '../../../config/env.js';

/** No-op storage for in-memory / local dev */
const noopStorage: StorageService = {
  async uploadPhoto() { return { url: 'noop://photo', key: 'noop' }; },
  async deletePhoto() {},
  async deletePhotosByPrefix() {},
  async uploadDocument() { return { url: 'noop://doc', key: 'noop', signedUrl: 'noop://signed' }; },
  async deleteDocument() {},
  async getSignedUrl() { return 'noop://signed'; },
};

/**
 * Factory function to create the storage service
 */
export function createStorageService(): StorageService {
  if (env.PERSISTENCE_DRIVER === 'in-memory') {
    console.info('[Storage] Using no-op storage (in-memory mode)');
    return noopStorage;
  }

  console.info('[Storage] Initializing GCS storage service:', {
    hasGcpServiceAccountKeyBase64: !!env.GCP_SERVICE_ACCOUNT_KEY_BASE64,
    hasGcsProject1Id: !!env.GCS_PROJECT_ID,
    hasGcsBucketName: !!env.GCS_BUCKET_NAME,
    hasGcsClientEmail: !!env.GCS_CLIENT_EMAIL,
    hasGcsPrivateKey: !!env.GCS_PRIVATE_KEY,
  });

  return new GCSStorageService();
}
