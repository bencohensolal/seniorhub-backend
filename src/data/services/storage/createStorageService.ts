import { GCSStorageService } from './GCSStorageService.js';
import type { StorageService } from './types.js';
import { env } from '../../../config/env.js';

/**
 * Factory function to create the storage service (always GCS)
 */
export function createStorageService(): StorageService {
  console.info('[Storage] Initializing GCS storage service:', {
    hasGcpServiceAccountKeyBase64: !!env.GCP_SERVICE_ACCOUNT_KEY_BASE64,
    hasGcsProject1Id: !!env.GCS_PROJECT_ID,
    hasGcsBucketName: !!env.GCS_BUCKET_NAME,
    hasGcsClientEmail: !!env.GCS_CLIENT_EMAIL,
    hasGcsPrivateKey: !!env.GCS_PRIVATE_KEY,
  });

  return new GCSStorageService();
}
