# Documents System

## Overview

The Documents system provides a hierarchical file storage system for households, allowing caregivers and family members to organize medical and administrative documents for seniors. The system features:

- **Two system root folders**: Medical File and Administrative
- **Senior-specific folders**: Automatically created under Medical File root for each senior in the household
- **Hierarchical organization**: Folders can contain subfolders and documents
- **Permission-based access**: `viewDocuments` and `manageDocuments` permissions control read/write access
- **File storage integration**: Supports uploading documents to cloud storage (Google Cloud Storage)

## Architecture

### Backend Entities

#### DocumentFolder
Represents a folder in the documents hierarchy.

```typescript
interface DocumentFolder {
  id: string;
  householdId: string;
  name: string;
  description?: string;
  parentFolderId?: string;
  seniorId?: string;
  isSystemRoot: boolean;
  systemRootType?: 'medical' | 'administrative';
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Document
Represents an uploaded file/document.

```typescript
interface Document {
  id: string;
  householdId: string;
  folderId: string;
  name: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  extension: string;
  seniorId?: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Use Cases

1. **ListDocumentRootsUseCase**: Lists system roots (Medical, Administrative) and senior folders
2. **ListFolderContentUseCase**: Lists folders and documents within a specific folder
3. **CreateFolderUseCase**: Creates a new folder (requires `manageDocuments` permission)
4. **UpdateFolderUseCase**: Updates folder metadata
5. **DeleteFolderUseCase**: Deletes a folder
6. **CreateDocumentUseCase**: Creates a document record (after file upload)
7. **UpdateDocumentUseCase**: Updates document metadata
8. **DeleteDocumentUseCase**: Deletes a document
9. **SearchDocumentsUseCase**: Searches across folders and documents by name/description

### Permissions

Two new permissions have been added to the household permissions system:

- **viewDocuments**: Allows viewing documents and folders
- **manageDocuments**: Allows creating, updating, and deleting documents and folders

Tablets (display tablets) have `viewDocuments` permission automatically but cannot perform write operations.

### API Endpoints

| Endpoint | Method | Description | Permission Required |
|----------|--------|-------------|---------------------|
| `/v1/households/:householdId/documents/roots` | GET | List system roots and senior folders | viewDocuments |
| `/v1/households/:householdId/documents/folders` | GET | List folders and documents by parent folder | viewDocuments |
| `/v1/households/:householdId/documents/folders` | POST | Create a folder | manageDocuments |
| `/v1/households/:householdId/documents/folders/:folderId` | PATCH | Update folder | manageDocuments |
| `/v1/households/:householdId/documents/folders/:2olderId` | DELETE | Delete folder | manageDocuments |
| `/v1/households/:householdId/documents` | POST | Create document | manageDocuments |
| `/v1/households/:householdId/documents/:documentId` | PATCH | Update document | manageDocuments |
| `/v1/households/:householdId/documents/:documentId` | DELETE | Delete document | manageDocuments |
| `/v1/households/:householdId/documents/search` | GET | Search documents | viewDocuments |

### Database Schema

The system uses two main tables:

1. **document_folders**: Stores folder information with hierarchical relationships
2. **documents**: Stores document metadata (actual files are stored in Google Cloud Storage)

See migration `021_documents.sql` for full schema details.

## Frontend Implementation

### Hooks

The frontend provides a comprehensive hook system for managing documents:

1. **useDocumentsData**: Loads document roots, folder content, and handles search
2. **useDocumentActions**: Provides CRUD operations for folders and documents
3. **useDocumentNavigation**: Manages folder navigation, breadcrumbs, and path tracking
4. **useDocumentStats**: Calculates statistics (folder counts, document counts)
5. **useDocumentState**: Unified state management for loading/error/empty states

### Components

The DocumentsScreen uses modular components:

1. **DocumentCard**: Displays a folder or document with metadata
2. **EmptyDocumentsState**: Shows empty state with optional action
3. **LoadingState**: Shows loading indicators (spinner or skeleton)
4. **ErrorBanner**: Displays errors with retry option
5. **DocumentActionsModal**: Modal for create/rename/delete actions

### Repository

The `ApiDocumentsRepository` handles all API communication with the backend, supporting both user context (web/mobile app) and tablet context (display tablets).

## Integration Points

### File Storage Service

Documents are stored in Google Cloud Storage with the following structure:
```
documents/{householdId}/{folderId}/{timestamp}_{originalFilename}
```

The `StorageService` handles:
- File upload to GCS
- Generating public URLs for viewing
- File deletion from GCS

### Permission Integration

The documents system integrates with the existing household permission system:
- Tablet users automatically get `viewDocuments` permission
- Caregiver and family roles can have both `viewDocuments` and `manageDocuments`
- Senior roles typically only have `viewDocuments`

### Senior Integration

Senior folders are automatically created under the Medical File root when:
1. A senior member is added to the household
2. The system roots are initialized for a household

## Testing

### Backend Tests
- **CreateFolderUseCase.test.ts**: Tests folder creation with permission validation
- **ListDocumentRootsUseCase.test.ts**: Tests root listing and senior folder inclusion

### Frontend Tests
- **DocumentCard.test.tsx**: Tests the DocumentCard component rendering and interactions
- **useDocumentsData.test.tsx**: Tests the data loading hook with mock repository

## Deployment Considerations

1. **Google Cloud Storage**: Must be configured with appropriate buckets and permissions
2. **Database Migration**: Migration `021_documents.sql` must be run before deployment
3. **Permission Updates**: Existing household members need permission updates via admin interface

## Future Enhancements

1. **Document preview**: Integrate with document viewing services (PDF, image preview)
2. **Batch operations**: Bulk upload, move, or delete
3. **Versioning**: Document version history
4. **Sharing**: Share individual documents with external parties
5. **Annotations**: Add notes/comments to documents
