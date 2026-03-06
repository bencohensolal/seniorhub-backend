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
  
  if (provider === 's3') {
    return new S3StorageService();
  }
  
  // Default to GCS (recommended for SeniorHub)
  return new GCSStorageService();
}
