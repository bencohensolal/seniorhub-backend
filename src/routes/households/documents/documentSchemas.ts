import { z } from 'zod';

// System root type enum schema
export const systemRootTypeSchema = z.enum(['medical', 'administrative']);

// Schema for creating a new document folder
export const createDocumentFolderBodySchema = z.object({
  parentFolderId: z.string().uuid('Invalid folder ID format').nullable().optional(),
  seniorId: z.string().uuid('Invalid senior ID format').nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  isSystemRoot: z.boolean().optional().default(false),
  systemRootType: systemRootTypeSchema.nullable().optional(),
});

// Schema for updating an existing document folder (all fields optional for partial update)
export const updateDocumentFolderBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  parentFolderId: z.string().uuid('Invalid folder ID format').nullable().optional(),
});

// Schema for document folder URL parameters
export const documentFolderParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  folderId: z.string().uuid('Invalid folder ID format'),
});

// Schema for listing document folders by parent
export const listFoldersByParentQuerySchema = z.object({
  parentFolderId: z.string().uuid('Invalid folder ID format').nullable().optional(),
});

// Schema for creating a new document
export const createDocumentBodySchema = z.object({
  folderId: z.string().uuid('Invalid folder ID format'),
  seniorId: z.string().uuid('Invalid senior ID format').nullable().optional(),
  name: z.string().min(1).max(200),
  originalFilename: z.string().min(1).max(500),
  storageKey: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100),
  fileSizeBytes: z.number().int().positive().max(100 * 1024 * 1024), // Max 100MB
  extension: z.string().max(20),
});

// Schema for updating an existing document (all fields optional for partial update)
export const updateDocumentBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  folderId: z.string().uuid('Invalid folder ID format').optional(),
  seniorId: z.string().uuid('Invalid senior ID format').nullable().optional(),
});

// Schema for document URL parameters
export const documentParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  documentId: z.string().uuid('Invalid document ID format'),
});

// Schema for listing documents by folder
export const listDocumentsByFolderQuerySchema = z.object({
  folderId: z.string().uuid('Invalid folder ID format'),
});

// Schema for searching documents and folders
export const searchDocumentsQuerySchema = z.object({
  query: z.string().min(1).max(100),
});

// Response schemas
export const documentFolderResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  parentFolderId: z.string().uuid().nullable(),
  seniorId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  isSystemRoot: z.boolean(),
  systemRootType: systemRootTypeSchema.nullable(),
  createdByUserId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export const documentResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  folderId: z.string().uuid(),
  seniorId: z.string().uuid().nullable(),
  name: z.string(),
  originalFilename: z.string(),
  storageKey: z.string(),
  mimeType: z.string(),
  fileSizeBytes: z.number().int(),
  extension: z.string(),
  uploadedByUserId: z.string().uuid(),
  uploadedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export const documentRootsResponseSchema = z.object({
  systemRoots: z.array(documentFolderResponseSchema),
  seniorFolders: z.array(documentFolderResponseSchema),
});

export const searchDocumentsResponseSchema = z.object({
  documents: z.array(documentResponseSchema),
  folders: z.array(documentFolderResponseSchema),
});
