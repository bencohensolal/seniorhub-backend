import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../../../config/env.js';
import type { StorageService, PhotoUploadInput, UploadPhotoResult } from './types.js';
import { MAX_PHOTO_DIMENSION, TARGET_PHOTO_SIZE_MB } from '../../../domain/entities/PhotoScreen.js';

export class S3StorageService implements StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private cloudFrontUrl: string | undefined;

  constructor() {
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_S3_BUCKET) {
      throw new Error('S3 configuration is incomplete. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET environment variables.');
    }

    this.s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });

    this.bucket = env.AWS_S3_BUCKET;
    this.cloudFrontUrl = env.AWS_CLOUDFRONT_URL;
  }

  async uploadPhoto(input: PhotoUploadInput): Promise<UploadPhotoResult> {
    // Process and compress the image
    const processedBuffer = await this.processImage(input.buffer, input.mimeType);

    // Determine file extension
    const extension = this.getExtensionFromMimeType(input.mimeType);
    
    // Generate S3 key
    const key = `households/${input.householdId}/tablets/${input.tabletId}/photos/${input.photoId}.${extension}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: processedBuffer,
      ContentType: input.mimeType,
      CacheControl: 'max-age=31536000', // 1 year cache
    });

    await this.s3Client.send(command);

    // Generate URL (CloudFront or S3)
    const url = this.generateUrl(key);

    return { url, key };
  }

  async deletePhoto(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async deletePhotosByPrefix(prefix: string): Promise<void> {
    // List all objects with the given prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    });

    const listResponse = await this.s3Client.send(listCommand);

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return; // No objects to delete
    }

    // Delete all objects
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: this.bucket,
      Delete: {
        Objects: listResponse.Contents.map(obj => ({ Key: obj.Key! })),
      },
    });

    await this.s3Client.send(deleteCommand);
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

  /**
   * Generate public URL for the photo
   */
  private generateUrl(key: string): string {
    if (this.cloudFrontUrl) {
      // Use CloudFront URL if configured
      return `${this.cloudFrontUrl}/${key}`;
    }

    // Fallback to S3 direct URL
    return `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }

  /**
   * Extract S3 key from URL
   */
  static extractKeyFromUrl(url: string): string | null {
    // Try to match CloudFront or S3 URL patterns
    const patterns = [
      /\/households\/[^/]+\/tablets\/[^/]+\/photos\/[^/]+\.[^/]+/, // Match the key pattern
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[0].substring(1); // Remove leading slash
      }
    }

    return null;
  }
}
