import { S3StorageService } from './S3StorageService.js';
import { GCSStorageService } from './GCSStorageService.js';
import type { StorageService } from './types.js';
import { env } from '../../../config/env.js';

/**
 * Factory function to create the appropriate storage service
 * based on configuration
 */
export function createStorageService(): StorageService {
  const provider = env.STORAGE_PROVIDER || 'gcs';
  
  console.log('[Storage] Initializing storage service:', {
    provider,
    hasGcpServiceAccountKeyBase64: !!env.GCP_SERVICE_ACCOUNT_KEY_BASE64,
    hasGcsProjectId: !!env.GCS_PROJECT_ID,
    hasGcsBucketName: !!env.GCS_BUCKET_NAME,
    hasGcsClientEmail: !!env.GCS_CLIENT_EMAIL,
    hasGcsPrivateKey: !!env.GCS_PRIVATE_KEY,
    hasS3Region: !!env.AWS_S3_REGION,
    hasS3Bucket: !!env.AWS_S3_BUCKET_NAME,
  });
  
  if (provider === 's3') {
    return new S3StorageService();
  }
  
  // Default to GCS (recommended for SeniorHub)
  return new GCSStorageService();
}
