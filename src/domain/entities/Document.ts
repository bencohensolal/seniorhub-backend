export interface Document {
  id: string;
  householdId: string;
  folderId: string;
  seniorId: string | null; // optional association with a senior
  name: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  extension: string;
  uploadedByUserId: string;
  uploadedAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateDocumentInput {
  householdId: string;
  folderId: string;
  seniorId?: string | null | undefined;
  name: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  extension: string;
  uploadedByUserId: string;
}

export interface UpdateDocumentInput {
  name?: string | undefined;
  folderId?: string | undefined; // moving document
  seniorId?: string | null | undefined;
}

export interface DocumentWithFolder extends Document {
  folder: {
    id: string;
    name: string;
    type: string;
  };
}

export interface DocumentUploadInitiation {
  uploadId: string;
  uploadUrl: string;
  method: string;
  headers: Record<string, string>;
  document: Document;
}

// Helper to get file extension from filename
export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
};

// Helper to get readable file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

// Supported MIME types for documents
export const SUPPORTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
];

// Maximum file size (50 MB)
export const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024;
