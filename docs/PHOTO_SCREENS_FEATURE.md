# Photo Screens Feature for Display Tablets

## Overview

The photo screens feature allows users to create personalized photo gallery displays on their tablets. Each tablet can have up to 5 photo screens, and each screen can contain up to 6 photos.

## Feature Specifications

### Limits
- **Max photo screens per tablet**: 5
- **Max photos per screen**: 6
- **Max photo caption length**: 100 characters
- **Max photo screen name**: 50 characters
- **Max photo file size**: 5 MB (before compression)
- **Target compressed size**: 1 MB
- **Max photo dimensions**: 1920x1080 pixels

### Display Modes
- **Slideshow**: Photos rotate automatically with configurable duration (3, 5, 10, 15, 30 seconds)
- **Mosaic**: All photos displayed in a grid layout
- **Single**: One photo displayed at a time

### Slideshow Options
- **Transition**: fade, slide, or none
- **Order**: sequential or random
- **Show captions**: Toggle photo captions on/off

### Supported Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)

## Database Schema

### photo_screens Table
```sql
CREATE TABLE photo_screens (
  id VARCHAR(50) PRIMARY KEY,
  tablet_id VARCHAR(50) NOT NULL,
  household_id VARCHAR(50) NOT NULL,
  name VARCHAR(50) NOT NULL,
  display_mode VARCHAR(20) NOT NULL DEFAULT 'slideshow',
  slideshow_duration INTEGER DEFAULT 5,
  slideshow_transition VARCHAR(20) DEFAULT 'fade',
  slideshow_order VARCHAR(20) DEFAULT 'sequential',
  show_captions BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(50) NOT NULL,
  updated_at TIMESTAMP,
  FOREIGN KEY (tablet_id) REFERENCES display_tablets(id) ON DELETE CASCADE,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);
```

### photos Table
```sql
CREATE TABLE photos (
  id VARCHAR(50) PRIMARY KEY,
  photo_screen_id VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  caption VARCHAR(100),
  display_order INTEGER NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  FOREIGN KEY (photo_screen_id) REFERENCES photo_screens(id) ON DELETE CASCADE
);
```

## API Endpoints

### Photo Screens

#### Create Photo Screen
```
POST /v1/households/:householdId/display-tablets/:tabletId/photo-screens
```
**Permissions**: Caregivers only

**Request Body**:
```json
{
  "name": "Vacances été 2025",
  "displayMode": "slideshow",
  "slideshowDuration": 5,
  "slideshowTransition": "fade",
  "slideshowOrder": "sequential",
  "showCaptions": false
}
```

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "ps_abc123xyz",
    "name": "Vacances été 2025",
    "displayMode": "slideshow",
    "slideshowDuration": 5,
    "slideshowTransition": "fade",
    "slideshowOrder": "sequential",
    "showCaptions": false,
    "photos": [],
    "createdAt": "2026-03-06T12:30:00.000Z"
  }
}
```

#### List Photo Screens
```
GET /v1/households/:householdId/display-tablets/:tabletId/photo-screens
```
**Permissions**: All household members

#### Get Photo Screen
```
GET /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId
```

#### Update Photo Screen
```
PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId
```
**Permissions**: Caregivers only

#### Delete Photo Screen
```
DELETE /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId
```
**Permissions**: Caregivers only
**Note**: Deletes all associated photos from S3 and database

### Photos

#### Upload Photo
```
POST /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos
```
**Permissions**: Caregivers only
**Content-Type**: multipart/form-data

**Form Data**:
- `photo`: File (required)
- `caption`: string (optional, max 100 chars)
- `order`: number (required, 0-5)

**Response** (201):
```json
{
  "success": true,
  "data": {
    "id": "ph_xyz789abc",
    "url": "https://cdn.seniorhub.com/households/hh_123/tablets/tb_456/photos/ph_xyz789abc.jpg",
    "caption": "Au bord de la mer",
    "order": 0,
    "uploadedAt": "2026-03-06T12:35:00.000Z"
  }
}
```

#### Update Photo
```
PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/:photoId
```
**Permissions**: Caregivers only

**Request Body**:
```json
{
  "caption": "Updated caption",
  "order": 2
}
```

#### Delete Photo
```
DELETE /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/:photoId
```
**Permissions**: Caregivers only
**Note**: Deletes photo from S3 and database

#### Reorder Photos
```
PUT /v1/households/:householdId/display-tablets/:tabletId/photo-screens/:screenId/photos/reorder
```
**Permissions**: Caregivers only

**Request Body**:
```json
{
  "photoOrders": [
    { "id": "ph_001", "order": 0 },
    { "id": "ph_002", "order": 1 },
    { "id": "ph_003", "order": 2 }
  ]
}
```

## Storage Strategy

### AWS S3 + CloudFront (Recommended)

**Bucket Structure**:
```
/households/{householdId}/tablets/{tabletId}/photos/{photoId}.{ext}

Example:
/households/hh_abc123/tablets/tb_xyz789/photos/ph_001.jpg
```

**Configuration**:
- Private S3 bucket with controlled access
- CloudFront CDN for image delivery
- Public URLs (no signed URLs for MVP)
- Cache-Control: max-age=31536000 (1 year)
- Automatic compression on upload
- Image resizing to max 1920x1080

**Environment Variables Required**:
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=seniorhub-photos
AWS_CLOUDFRONT_URL=https://cdn.seniorhub.com
```

## Image Processing

### Upload Flow
1. Validate file format (JPEG, PNG, WebP only)
2. Validate file size (max 5 MB)
3. Resize if dimensions > 1920x1080 (maintain aspect ratio)
4. Compress to target 1 MB or less
   - JPEG: quality 85%
   - PNG: optimize with pngquant
   - WebP: quality 85%
5. Generate unique filename: `{photoId}.{ext}`
6. Upload to S3
7. Generate CloudFront URL
8. Store URL in database

### Delete Flow
1. Parse S3 key from URL
2. Delete from S3
3. Delete record from database

## Error Codes

```typescript
// 400 - Bad Request
{
  "success": false,
  "error": {
    "code": "MAX_PHOTO_SCREENS_REACHED",
    "message": "Cette tablette a déjà atteint la limite de 5 écrans photos"
  }
}

{
  "success": false,
  "error": {
    "code": "MAX_PHOTOS_REACHED",
    "message": "Cet écran a déjà atteint la limite de 6 photos"
  }
}

{
  "success": false,
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "La photo ne doit pas dépasser 5 MB"
  }
}

{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_FORMAT",
    "message": "Format non supporté. Utilisez JPEG, PNG ou WebP"
  }
}

// 403 - Forbidden
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Seuls les caregivers peuvent gérer les écrans photos"
  }
}

// 404 - Not Found
{
  "success": false,
  "error": {
    "code": "PHOTO_SCREEN_NOT_FOUND",
    "message": "Écran photo introuvable"
  }
}

{
  "success": false,
  "error": {
    "code": "PHOTO_NOT_FOUND",
    "message": "Photo introuvable"
  }
}
```

## Tablet Config Integration

Photo screens are included in the tablet configuration returned by:
```
GET /v1/households/:householdId/display-tablets/:tabletId/config
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "slideDuration": 10000,
    "dataCacheDuration": 300000,
    "dataRefreshInterval": 300000,
    "screens": [
      {
        "type": "summary",
        "enabled": true,
        "order": 0,
        "settings": {...}
      },
      {
        "type": "photoGallery",
        "enabled": true,
        "order": 1,
        "settings": {
          "id": "ps_abc123",
          "name": "Vacances 2025",
          "photos": [
            {
              "id": "ph_001",
              "url": "https://cdn.seniorhub.com/.../ph_001.jpg",
              "caption": "Au bord de la mer",
              "order": 0,
              "uploadedAt": "2026-03-06T12:35:00.000Z"
            }
          ],
          "displayMode": "slideshow",
          "slideshowDuration": 5,
          "slideshowTransition": "fade",
          "slideshowOrder": "sequential",
          "showCaptions": true
        }
      }
    ],
    "lastUpdated": "2026-03-06T13:00:00.000Z"
  }
}
```

## Security Considerations

1. **Authentication**: Only authenticated caregivers can manage photo screens
2. **Authorization**: Validate household membership for all operations
3. **File Validation**: 
   - Verify MIME type (not just extension)
   - Scan for malware if possible (AWS Lambda)
   - Limit file size strictly
4. **URL Security**: 
   - Use public CloudFront URLs for MVP
   - Consider signed URLs for enhanced security in future
5. **Rate Limiting**: Limit photo uploads per household/user
6. **Storage Quota**: Consider implementing household storage limits

## Performance Optimization

1. **CDN Caching**: CloudFront caches images globally
2. **Image Optimization**: Compress and resize on upload
3. **Lazy Loading**: Tablet app loads images on demand
4. **Batch Operations**: Reorder multiple photos in single request
5. **SSE Updates**: Real-time config updates via Server-Sent Events

## Testing Strategy

### Unit Tests
- Photo screen validation logic
- Image processing functions
- S3 upload/delete operations
- Limit enforcement (5 screens, 6 photos)

### Integration Tests
- Complete photo upload flow
- Photo screen CRUD operations
- Permission checks
- Error handling

### Load Tests
- Concurrent photo uploads
- Large file handling
- S3 connection pool management

## Deployment Checklist

- [ ] Run migration `018_photo_screens.sql`
- [ ] Create S3 bucket with appropriate policies
- [ ] Set up CloudFront distribution
- [ ] Configure environment variables
- [ ] Install dependencies (@aws-sdk/client-s3, sharp, @fastify/multipart)
- [ ] Test with real AWS credentials
- [ ] Set up monitoring for S3 costs
- [ ] Configure backup strategy for photos
- [ ] Document S3 bucket lifecycle policies

## Future Enhancements

1. **Signed URLs**: For enhanced security
2. **Thumbnail Generation**: For mobile app previews
3. **Photo Metadata**: EXIF data extraction (date, location)
4. **Batch Upload**: Multiple photos at once
5. **Photo Editing**: Crop, rotate, filters
6. **Photo Sharing**: Between households
7. **Storage Quotas**: Per household limits
8. **Photo Categories**: Tags and albums
9. **Face Detection**: Auto-detect people in photos
10. **AI Captions**: Auto-generate captions
