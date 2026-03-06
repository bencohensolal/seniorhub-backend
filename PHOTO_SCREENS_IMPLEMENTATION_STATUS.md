# Photo Screens Implementation Status

## Overview
Implementation of photo gallery screens feature for display tablets, allowing users to create custom photo displays.

## ✅ Completed Tasks

### 1. Type Definitions & Entities
- [x] Added `photoGallery` to `ScreenType` enum in `TabletDisplayConfig.ts`
- [x] Created `PhotoGalleryScreenSettings` interface with all required fields
- [x] Created `PhotoItem` interface for individual photos
- [x] Created complete `PhotoScreen` entity (`src/domain/entities/PhotoScreen.ts`)
- [x] Defined all input types (`CreatePhotoScreenInput`, `UpdatePhotoScreenInput`, etc.)
- [x] Defined constants (max limits, defaults)

### 2. Database Schema
- [x] Created migration `018_photo_screens.sql`
- [x] Defined `photo_screens` table with proper constraints
- [x] Defined `photos` table with proper constraints
- [x] Added indexes for performance
- [x] Set up foreign key cascades

### 3. Validation Schemas
- [x] Updated `displayTabletConfigSchemas.ts` to include `photoGallery` screen type
- [x] Created `photoItemSchema` validation
- [x] Created `photoGalleryScreenSettingsSchema` validation
- [x] Updated `validateScreenSettings` function to handle photo gallery screens

### 4. Configuration
- [x] Added S3 configuration to `env.ts`:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION`
  - `AWS_S3_BUCKET`
  - `AWS_CLOUDFRONT_URL`

### 5. Domain Errors
- [x] Created photo-specific error classes:
  - `MaxPhotoScreensReachedError`
  - `MaxPhotosReachedError`
  - `UnsupportedFileFormatError`
  - `FileTooLargeError`
  - `PhotoScreenNotFoundError`
  - `PhotoNotFoundError`
- [x] Exported all errors from `domain/errors/index.ts`

### 6. Repository Interface
- [x] Added photo screen methods to `HouseholdRepository` interface:
  - `listPhotoScreens`
  - `getPhotoScreenById`
  - `createPhotoScreen`
  - `updatePhotoScreen`
  - `deletePhotoScreen`
  - `countPhotoScreens`
- [x] Added photo methods to `HouseholdRepository` interface:
  - `listPhotos`
  - `getPhotoById`
  - `createPhoto`
  - `updatePhoto`
  - `deletePhoto`
  - `countPhotos`
  - `reorderPhotos`

## 🚧 Remaining Tasks

### 7. Repository Implementation
- [x] Implement photo screen methods in `PostgresHouseholdRepository`
  - [x] `listPhotoScreens` - Query with JOIN to get photos
  - [x] `getPhotoScreenById` - Single screen with photos
  - [x] `createPhotoScreen` - Insert with UUID generation
  - [x] `updatePhotoScreen` - Update metadata only
  - [x] `deletePhotoScreen` - Delete cascade (will delete photos too)
  - [x] `countPhotoScreens` - Count for limit validation
- [x] Implement photo methods in `PostgresHouseholdRepository`
  - [x] `listPhotos` - Get all photos for a screen
  - [x] `getPhotoById` - Get single photo
  - [x] `createPhoto` - Insert new photo record
  - [x] `updatePhoto` - Update photo metadata (caption, order)
  - [x] `deletePhoto` - Delete single photo
  - [x] `countPhotos` - Count for limit validation
  - [x] `reorderPhotos` - Batch update photo orders

### 8. S3 Storage Service
- [ ] Create `src/data/services/storage/S3StorageService.ts`
  - [ ] Configure AWS SDK
  - [ ] `uploadPhoto(file, householdId, tabletId, photoId)` - Upload to S3
  - [ ] `deletePhoto(url)` - Delete from S3
  - [ ] `deletePhotosByPrefix(prefix)` - Batch delete
  - [ ] Image processing (resize, compress)
  - [ ] Generate CloudFront URLs
- [ ] Create `src/data/services/storage/types.ts` for storage interfaces
- [ ] Handle both S3 and fallback (local/mock) storage for dev

### 9. Use Cases - Photo Screens
- [ ] Create `CreatePhotoScreenUseCase.ts`
  - [ ] Validate tablet exists
  - [ ] Check caregiver permission
  - [ ] Count existing screens (max 5)
  - [ ] Create photo screen with defaults
- [ ] Create `UpdatePhotoScreenUseCase.ts`
  - [ ] Validate screen exists
  - [ ] Check permissions
  - [ ] Update metadata only
- [ ] Create `DeletePhotoScreenUseCase.ts`
  - [ ] Validate screen exists
  - [ ] Check permissions
  - [ ] Delete all photos from S3
  - [ ] Delete screen (cascade to DB photos)
- [ ] Create `ListPhotoScreensUseCase.ts`
  - [ ] Validate tablet exists
  - [ ] Check household membership
  - [ ] Return screens with photos
- [ ] Create `GetPhotoScreenUseCase.ts`
  - [ ] Validate exists
  - [ ] Check permissions
  - [ ] Return with photos

### 10. Use Cases - Photos
- [ ] Create `UploadPhotoUseCase.ts`
  - [ ] Validate screen exists
  - [ ] Check caregiver permission
  - [ ] Count existing photos (max 6)
  - [ ] Validate file format (JPEG, PNG, WebP)
  - [ ] Validate file size (max 5MB)
  - [ ] Process image (resize, compress)
  - [ ] Upload to S3
  - [ ] Create photo record
- [ ] Create `UpdatePhotoUseCase.ts`
  - [ ] Validate photo exists
  - [ ] Check permissions
  - [ ] Update caption/order only
- [ ] Create `DeletePhotoUseCase.ts`
  - [ ] Validate photo exists
  - [ ] Check permissions
  - [ ] Delete from S3
  - [ ] Delete from DB
  - [ ] Reorder remaining photos
- [ ] Create `ReorderPhotosUseCase.ts`
  - [ ] Validate screen exists
  - [ ] Check permissions
  - [ ] Validate all photo IDs exist
  - [ ] Update orders in batch

### 11. API Routes
- [ ] Create `src/routes/households/photoScreenRoutes.ts`
- [ ] Implement endpoints:
  - [ ] `POST /v1/households/:householdId/display-tablets/:tabletId/photo-screens` - Create screen
  - [ ] `GET /v1/households/:householdId/display-tablets/:tabletId/photo-screens` - List screens
  - [ ] `GET /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId` - Get screen
  - [ ] `PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId` - Update screen
  - [ ] `DELETE /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId` - Delete screen
  - [ ] `POST /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos` - Upload photo (multipart/form-data)
  - [ ] `PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/:photoId` - Update photo metadata
  - [ ] `DELETE /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/:photoId` - Delete photo
  - [ ] `PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/reorder` - Reorder photos
- [ ] Create validation schemas for all endpoints
- [ ] Add route registration to `src/routes/households/index.ts`
- [ ] Configure multipart/form-data handling for photo uploads

### 12. Error Handler Updates
- [ ] Update `src/routes/errorHandler.ts` to handle new error types:
  - [ ] `MaxPhotoScreensReachedError` → 400
  - [ ] `MaxPhotosReachedError` → 400
  - [ ] `UnsupportedFileFormatError` → 400
  - [ ] `FileTooLargeError` → 400
  - [ ] `PhotoScreenNotFoundError` → 404
  - [ ] `PhotoNotFoundError` → 404

### 13. Config Integration
- [ ] Update tablet config endpoints to handle photoGallery screens
- [ ] Ensure `GET /v1/households/:householdId/display-tablets/:tabletId/config` returns photo screens properly
- [ ] Ensure `PUT /v1/households/:householdId/display-tablets/:tabletId/config` validates photo screens
- [ ] Trigger SSE config update when photos are added/removed

### 14. Testing & Documentation
- [ ] Unit tests for use cases
- [ ] Integration tests for API endpoints
- [ ] Test file upload handling
- [ ] Test S3 integration
- [ ] Test photo limits
- [ ] Update API documentation (if Swagger/OpenAPI exists)
- [ ] Update ARCHITECTURE.md
- [ ] Update CHANGELOG.md

### 15. Deployment Considerations
- [ ] Run migration `018_photo_screens.sql`
- [ ] Set up S3 bucket with proper permissions
- [ ] Configure CloudFront distribution
- [ ] Set environment variables for S3
- [ ] Test with real AWS credentials
- [ ] Consider image CDN caching strategy

## Technical Notes

### S3 Bucket Structure
```
/households/{householdId}/tablets/{tabletId}/photos/{photoId}.{ext}

Example:
/households/hh_abc123/tablets/tb_xyz789/photos/ph_001.jpg
```

### Image Processing
- Max upload size: 5 MB
- Target compressed size: 1 MB
- Max dimensions: 1920x1080 (tablet display)
- Supported formats: JPEG, PNG, WebP
- Quality: 85% for JPEG compression

### Security
- Caregivers only for create/update/delete operations
- All household members can view via config endpoint
- Tablets can read config (including photo URLs)
- Consider signed URLs for enhanced security (future)

### Performance
- CloudFront CDN for fast image delivery
- Cache-Control headers (1 year)
- Lazy loading on tablet app
- Batch operations for photo reordering

## Dependencies to Add

```json
{
  "@aws-sdk/client-s3": "^3.x.x",
  "@fastify/multipart": "^8.x.x",
  "sharp": "^0.33.x" // For image processing
}
```

## Next Steps

1. **Run the migration** to create the database tables
2. **Install dependencies** for S3 and image processing
3. **Implement repository methods** in PostgresHouseholdRepository
4. **Create the S3 storage service** for photo uploads
5. **Implement use cases** for business logic
6. **Create API routes** and schemas
7. **Test the complete flow** end-to-end
8. **Deploy and configure S3** on production

## Estimated Remaining Effort

- Repository implementation: ~2-3 hours
- S3 service: ~2 hours
- Use cases: ~3-4 hours  
- API routes: ~3-4 hours
- Testing: ~2-3 hours
- **Total**: ~12-16 hours of development time
