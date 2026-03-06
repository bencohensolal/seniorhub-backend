import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import { env } from '../../../config/env.js';
import type { StorageService, PhotoUploadInput, UploadPhotoResult } from './types.js';
import { MAX_PHOTO_DIMENSION, TARGET_PHOTO_SIZE_MB } from '../../../domain/entities/PhotoScreen.js';

/**
 * Google Cloud Storage implementation for photo storage
 */
export class GCSStorageService implements StorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    console.log('[GCS] Initializing GCS Storage Service...');
    
    // Option 1: With base64 encoded service account key
    if (env.GCP_SERVICE_ACCOUNT_KEY_BASE64 && env.GCS_PROJECT_ID) {
      console.log('[GCS] Using Option 1: Base64 encoded service account key');
      const credentials = JSON.parse(
        Buffer.from(env.GCP_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf-8')
      );
      this.storage = new Storage({
        projectId: env.GCS_PROJECT_ID,
        credentials,
      });
    }
    // Option 2: With individual environment variables
    else if (env.GCS_PRIVATE_KEY && env.GCS_CLIENT_EMAIL && env.GCS_PROJECT_ID) {
      console.log('[GCS] Using Option 2: Individual env vars (client_email + private_key)');
      this.storage = new Storage({
        projectId: env.GCS_PROJECT_ID,
        credentials: {
          client_email: env.GCS_CLIENT_EMAIL,
          private_key: env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
      });
    }
    // Option 3: Default (uses GOOGLE_APPLICATION_CREDENTIALS env var)
    else if (env.GCS_PROJECT_ID) {
      console.log('[GCS] Using Option 3: Default credentials (GOOGLE_APPLICATION_CREDENTIALS)');
      this.storage = new Storage({
        projectId: env.GCS_PROJECT_ID,
      });
    }
    else {
      console.error('[GCS] Configuration error:', {
        hasGcpServiceAccountKeyBase64: !!env.GCP_SERVICE_ACCOUNT_KEY_BASE64,
        hasGcsProjectId: !!env.GCS_PROJECT_ID,
        hasGcsClientEmail: !!env.GCS_CLIENT_EMAIL,
        hasGcsPrivateKey: !!env.GCS_PRIVATE_KEY,
        hasGcsBucketName: !!env.GCS_BUCKET_NAME,
      });
      throw new Error('GCS configuration is incomplete. Please set GCS_BUCKET_NAME, GCS_PROJECT_ID, and either GCP_SERVICE_ACCOUNT_KEY_BASE64 or GCS_CLIENT_EMAIL + GCS_PRIVATE_KEY.');
    }

    if (!env.GCS_BUCKET_NAME) {
      console.error('[GCS] GCS_BUCKET_NAME is missing!');
      throw new Error('GCS_BUCKET_NAME is required');
    }
    
    this.bucketName = env.GCS_BUCKET_NAME;
    console.log('[GCS] ✅ Initialized successfully with bucket:', this.bucketName);
  }

  async uploadPhoto(input: PhotoUploadInput): Promise<UploadPhotoResult> {
    // Process and compress the image
    const processedBuffer = await this.processImage(input.buffer, input.mimeType);

    // Determine file extension
    const extension = this.getExtensionFromMimeType(input.mimeType);
    
    // Generate GCS key (same structure as S3)
    const key = `households/${input.householdId}/tablets/${input.tabletId}/photos/${input.photoId}.${extension}`;

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);

    await file.save(processedBuffer, {
      metadata: {
        contentType: input.mimeType,
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
      public: true, // Make file publicly accessible
    });

    // Public URL format for GCS
    const url = `https://storage.googleapis.com/${this.bucketName}/${key}`;

    return { url, key };
  }

  async deletePhoto(key: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(key);
    
    await file.delete().catch((error) => {
      // Ignore if file doesn't exist
      if (error.code !== 404) {
        throw error;
      }
    });
  }

  async deletePhotosByPrefix(prefix: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    
    // List all files with the given prefix
    const [files] = await bucket.getFiles({ prefix });

    if (files.length === 0) {
      return; // No files to delete
    }

    // Delete all files
    await Promise.all(files.map(file => file.delete().catch(() => {
      // Ignore errors during deletion
    })));
  }

  /**
   * Process and compress image to meet size and dimension requirements
   */
  private async processImage(buffer: Buffer, mimeType: string): Promise<Buffer> {
    const targetSizeBytes = TARGET_PHOTO_SIZE_MB * 1024 * 1024; // Convert MB to bytes

    // Start with sharp instance
    let image = sharp(buffer);

    // Get metadata
    const metadata = await image.metadata();

    // Resize if dimensions exceed max
    if (metadata.width && metadata.width > MAX_PHOTO_DIMENSION || metadata.height && metadata.height > MAX_PHOTO_DIMENSION) {
      image = image.resize(MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION, {
        fit: 'inside', // Maintain aspect ratio
        withoutEnlargement: true,
      });
    }

    // Determine output format and compression
    let processedBuffer: Buffer;

    if (mimeType === 'image/png') {
      // PNG: compress with pngquant-like settings
      processedBuffer = await image.png({ quality: 85, compressionLevel: 9 }).toBuffer();
    } else if (mimeType === 'image/webp') {
      // WebP: compress with quality setting
      processedBuffer = await image.webp({ quality: 85 }).toBuffer();
    } else {
      // JPEG (default): compress with quality setting
      processedBuffer = await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    }

    // If still too large, reduce quality further
    if (processedBuffer.length > targetSizeBytes) {
      const qualityReduction = Math.min(75, Math.floor(85 * (targetSizeBytes / processedBuffer.length)));

      if (mimeType === 'image/png') {
        // Convert PNG to JPEG for better compression
        processedBuffer = await sharp(buffer)
          .resize(MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: qualityReduction, mozjpeg: true })
          .toBuffer();
      } else if (mimeType === 'image/webp') {
        processedBuffer = await sharp(buffer)
          .resize(MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: qualityReduction })
          .toBuffer();
      } else {
        processedBuffer = await sharp(buffer)
          .resize(MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: qualityReduction, mozjpeg: true })
          .toBuffer();
      }
    }

    return processedBuffer;
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      default:
        return 'jpg'; // Default to jpg
    }
  }
}
