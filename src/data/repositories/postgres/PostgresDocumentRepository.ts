import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Document, CreateDocumentInput, UpdateDocumentInput } from '../../../domain/entities/Document.js';
import type { DocumentFolder, DocumentFolderWithCounts, CreateDocumentFolderInput, UpdateDocumentFolderInput } from '../../../domain/entities/DocumentFolder.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  mapDocument,
  mapDocumentFolder,
} from './helpers.js';

export class PostgresDocumentRepository {
  constructor(protected readonly pool: Pool) {}

  async getDocumentFolderById(folderId: string, householdId: string): Promise<DocumentFolder | null> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      parent_folder_id: string | null;
      senior_id: string | null;
      name: string;
      description: string | null;
      type: 'system_root' | 'senior_folder' | 'user_folder';
      system_root_type: 'medical' | 'administrative' | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `SELECT id, household_id, parent_folder_id, senior_id, name, description,
              type, system_root_type, created_by_user_id,
              created_at, updated_at, deleted_at
       FROM document_folders
       WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [folderId, householdId],
    );

    const row = result.rows[0];
    return row ? mapDocumentFolder(row) : null;
  }

  async listDocumentFoldersByParent(householdId: string, parentFolderId: string | null): Promise<DocumentFolderWithCounts[]> {
    const countsSql = `
      (SELECT COUNT(*)::int FROM documents d WHERE d.folder_id = df.id AND d.deleted_at IS NULL) AS document_count,
      (SELECT COUNT(*)::int FROM document_folders sf WHERE sf.parent_folder_id = df.id AND sf.deleted_at IS NULL) AS folder_count`;
    const query = parentFolderId === null
      ? `SELECT df.id, df.household_id, df.parent_folder_id, df.senior_id, df.name, df.description,
                df.type, df.system_root_type, df.created_by_user_id,
                df.created_at, df.updated_at, df.deleted_at, ${countsSql}
         FROM document_folders df
         WHERE df.household_id = $1 AND df.parent_folder_id IS NULL AND df.deleted_at IS NULL
         ORDER BY df.name ASC`
      : `SELECT df.id, df.household_id, df.parent_folder_id, df.senior_id, df.name, df.description,
                df.type, df.system_root_type, df.created_by_user_id,
                df.created_at, df.updated_at, df.deleted_at, ${countsSql}
         FROM document_folders df
         WHERE df.household_id = $1 AND df.parent_folder_id = $2 AND df.deleted_at IS NULL
         ORDER BY df.name ASC`;

    const params = parentFolderId === null ? [householdId] : [householdId, parentFolderId];
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      parent_folder_id: string | null;
      senior_id: string | null;
      name: string;
      description: string | null;
      type: 'system_root' | 'senior_folder' | 'user_folder';
      system_root_type: 'medical' | 'administrative' | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
      document_count: number;
      folder_count: number;
    }>(query, params);

    return result.rows.map(mapDocumentFolder);
  }

  async createDocumentFolder(input: CreateDocumentFolderInput): Promise<DocumentFolder> {
    const id = randomUUID();
    const now = nowIso();

    // Determine type from input
    let type: 'system_root' | 'senior_folder' | 'user_folder';
    if (input.type) {
      type = input.type;
    } else if (input.isSystemRoot) {
      type = 'system_root';
    } else if (input.seniorId) {
      type = 'senior_folder';
    } else {
      type = 'user_folder';
    }

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      parent_folder_id: string | null;
      senior_id: string | null;
      name: string;
      description: string | null;
      type: 'system_root' | 'senior_folder' | 'user_folder';
      system_root_type: 'medical' | 'administrative' | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `INSERT INTO document_folders (
         id, household_id, parent_folder_id, senior_id, name, description,
         type, system_root_type, created_by_user_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING id, household_id, parent_folder_id, senior_id, name, description,
                 type, system_root_type, created_by_user_id,
                 created_at, updated_at, deleted_at`,
      [
        id,
        input.householdId,
        input.parentFolderId ?? null,
        input.seniorId ?? null,
        input.name,
        input.description ?? null,
        type,
        input.systemRootType ?? null,
        input.createdByUserId,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create document folder.');
    }

    return mapDocumentFolder(row);
  }

  async updateDocumentFolder(folderId: string, householdId: string, input: UpdateDocumentFolderInput): Promise<DocumentFolder> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.parentFolderId !== undefined) {
      updates.push(`parent_folder_id = $${paramIndex++}`);
      values.push(input.parentFolderId);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(folderId, householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      parent_folder_id: string | null;
      senior_id: string | null;
      name: string;
      description: string | null;
      type: 'system_root' | 'senior_folder' | 'user_folder';
      system_root_type: 'medical' | 'administrative' | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `UPDATE document_folders
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex - 1} AND household_id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, household_id, parent_folder_id, senior_id, name, description,
                 type, system_root_type, created_by_user_id,
                 created_at, updated_at, deleted_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Document folder not found.');
    }

    return mapDocumentFolder(row);
  }

  async deleteDocumentFolder(folderId: string, householdId: string): Promise<void> {
    const now = nowIso();
    const result = await this.pool.query(
      `UPDATE document_folders
       SET deleted_at = $1
       WHERE id = $2 AND household_id = $3 AND deleted_at IS NULL`,
      [now, folderId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Document folder not found.');
    }
  }

  async getDocumentById(documentId: string, householdId: string): Promise<Document | null> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      folder_id: string;
      senior_id: string | null;
      name: string;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `SELECT id, household_id, folder_id, senior_id, name, original_filename,
              storage_key, mime_type, file_size_bytes, extension,
              uploaded_by_user_id, uploaded_at, updated_at, deleted_at
       FROM documents
       WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [documentId, householdId],
    );

    const row = result.rows[0];
    return row ? mapDocument(row) : null;
  }

  async listDocumentsByFolder(folderId: string, householdId: string): Promise<Document[]> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      folder_id: string;
      senior_id: string | null;
      name: string;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `SELECT id, household_id, folder_id, senior_id, name, original_filename,
              storage_key, mime_type, file_size_bytes, extension,
              uploaded_by_user_id, uploaded_at, updated_at, deleted_at
       FROM documents
       WHERE folder_id = $1 AND household_id = $2 AND deleted_at IS NULL
       ORDER BY uploaded_at DESC`,
      [folderId, householdId],
    );

    return result.rows.map(mapDocument);
  }

  async createDocument(input: CreateDocumentInput): Promise<Document> {
    const id = randomUUID();
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      folder_id: string;
      senior_id: string | null;
      name: string;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `INSERT INTO documents (
         id, household_id, folder_id, senior_id, name, original_filename,
         storage_key, mime_type, file_size_bytes, extension,
         uploaded_by_user_id, uploaded_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING id, household_id, folder_id, senior_id, name, original_filename,
                 storage_key, mime_type, file_size_bytes, extension,
                 uploaded_by_user_id, uploaded_at, updated_at, deleted_at`,
      [
        id,
        input.householdId,
        input.folderId,
        input.seniorId ?? null,
        input.name,
        input.originalFilename,
        input.storageKey,
        input.mimeType,
        input.fileSizeBytes,
        input.extension,
        input.uploadedByUserId,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create document.');
    }

    return mapDocument(row);
  }

  async updateDocument(documentId: string, householdId: string, input: UpdateDocumentInput): Promise<Document> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.folderId !== undefined) {
      updates.push(`folder_id = $${paramIndex++}`);
      values.push(input.folderId);
    }
    if (input.seniorId !== undefined) {
      updates.push(`senior_id = $${paramIndex++}`);
      values.push(input.seniorId);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(documentId, householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      folder_id: string;
      senior_id: string | null;
      name: string;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `UPDATE documents
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex - 1} AND household_id = $${paramIndex} AND deleted_at IS NULL
       RETURNING id, household_id, folder_id, senior_id, name, original_filename,
                 storage_key, mime_type, file_size_bytes, extension,
                 uploaded_by_user_id, uploaded_at, updated_at, deleted_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Document not found.');
    }

    return mapDocument(row);
  }

  async deleteDocument(documentId: string, householdId: string): Promise<void> {
    const now = nowIso();
    const result = await this.pool.query(
      `UPDATE documents
       SET deleted_at = $1
       WHERE id = $2 AND household_id = $3 AND deleted_at IS NULL`,
      [now, documentId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Document not found.');
    }
  }

  async listSeniorFolders(householdId: string): Promise<DocumentFolderWithCounts[]> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      parent_folder_id: string | null;
      senior_id: string | null;
      name: string;
      description: string | null;
      type: 'system_root' | 'senior_folder' | 'user_folder';
      system_root_type: 'medical' | 'administrative' | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
      document_count: number;
      folder_count: number;
    }>(
      `SELECT df.id, df.household_id, df.parent_folder_id, df.senior_id, df.name, df.description,
              df.type, df.system_root_type, df.created_by_user_id,
              df.created_at, df.updated_at, df.deleted_at,
              (SELECT COUNT(*)::int FROM documents d WHERE d.folder_id = df.id AND d.deleted_at IS NULL) AS document_count,
              (SELECT COUNT(*)::int FROM document_folders sf WHERE sf.parent_folder_id = df.id AND sf.deleted_at IS NULL) AS folder_count
       FROM document_folders df
       WHERE df.household_id = $1 AND df.senior_id IS NOT NULL AND df.deleted_at IS NULL
       ORDER BY df.name ASC`,
      [householdId],
    );

    return result.rows.map(mapDocumentFolder);
  }

  async listSystemRoots(householdId: string): Promise<DocumentFolder[]> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      parent_folder_id: string | null;
      senior_id: string | null;
      name: string;
      description: string | null;
      type: 'system_root' | 'senior_folder' | 'user_folder';
      system_root_type: 'medical' | 'administrative' | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `SELECT id, household_id, parent_folder_id, senior_id, name, description,
              type, system_root_type, created_by_user_id,
              created_at, updated_at, deleted_at
       FROM document_folders
       WHERE household_id = $1 AND type = 'system_root' AND deleted_at IS NULL
       ORDER BY system_root_type ASC`,
      [householdId],
    );

    return result.rows.map(mapDocumentFolder);
  }

  async searchDocumentsAndFolders(householdId: string, query: string): Promise<{
    documents: Document[];
    folders: DocumentFolder[];
  }> {
    const searchPattern = `%${query}%`;

    const documentsResult = await this.pool.query<{
      id: string;
      household_id: string;
      folder_id: string;
      senior_id: string | null;
      name: string;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `SELECT id, household_id, folder_id, senior_id, name, original_filename,
              storage_key, mime_type, file_size_bytes, extension,
              uploaded_by_user_id, uploaded_at, updated_at, deleted_at
       FROM documents
       WHERE household_id = $1 AND deleted_at IS NULL
         AND (name ILIKE $2 OR original_filename ILIKE $2)
       ORDER BY uploaded_at DESC`,
      [householdId, searchPattern],
    );

    const foldersResult = await this.pool.query<{
      id: string;
      household_id: string;
      parent_folder_id: string | null;
      senior_id: string | null;
      name: string;
      description: string | null;
      type: 'system_root' | 'senior_folder' | 'user_folder';
      system_root_type: 'medical' | 'administrative' | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `SELECT id, household_id, parent_folder_id, senior_id, name, description,
              type, system_root_type, created_by_user_id,
              created_at, updated_at, deleted_at
       FROM document_folders
       WHERE household_id = $1 AND deleted_at IS NULL
         AND (name ILIKE $2 OR description ILIKE $2)
       ORDER BY name ASC`,
      [householdId, searchPattern],
    );

    return {
      documents: documentsResult.rows.map(mapDocument),
      folders: foldersResult.rows.map(mapDocumentFolder),
    };
  }

  async softDeleteDocumentFolder(folderId: string, householdId: string): Promise<void> {
    // Already implemented as deleteDocumentFolder
    return this.deleteDocumentFolder(folderId, householdId);
  }

  async restoreDocumentFolder(folderId: string, householdId: string): Promise<void> {
    const now = nowIso();
    const result = await this.pool.query(
      `UPDATE document_folders
       SET deleted_at = NULL, updated_at = $1
       WHERE id = $2 AND household_id = $3 AND deleted_at IS NOT NULL`,
      [now, folderId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Deleted document folder not found.');
    }
  }

  async getSystemRootFolder(householdId: string, systemRootType: 'medical' | 'administrative'): Promise<DocumentFolderWithCounts | null> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      parent_folder_id: string | null;
      senior_id: string | null;
      name: string;
      description: string | null;
      type: 'system_root' | 'senior_folder' | 'user_folder';
      system_root_type: 'medical' | 'administrative' | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
      document_count: number;
      folder_count: number;
    }>(
      `SELECT df.id, df.household_id, df.parent_folder_id, df.senior_id, df.name, df.description,
              df.type, df.system_root_type, df.created_by_user_id,
              df.created_at, df.updated_at, df.deleted_at,
              (SELECT COUNT(*)::int FROM documents d WHERE d.folder_id = df.id AND d.deleted_at IS NULL) AS document_count,
              (SELECT COUNT(*)::int FROM document_folders sf WHERE sf.parent_folder_id = df.id AND sf.deleted_at IS NULL) AS folder_count
       FROM document_folders df
       WHERE df.household_id = $1 AND df.type = 'system_root' AND df.system_root_type = $2 AND df.deleted_at IS NULL
       LIMIT 1`,
      [householdId, systemRootType],
    );

    const row = result.rows[0];
    return row ? mapDocumentFolder(row) : null;
  }

  async ensureSystemRootsForHousehold(householdId: string, userId: string): Promise<void> {
    const types: ('medical' | 'administrative')[] = ['medical', 'administrative'];
    for (const type of types) {
      const existing = await this.getSystemRootFolder(householdId, type);
      if (!existing) {
        await this.createDocumentFolder({
          householdId,
          parentFolderId: null,
          name: type === 'medical' ? 'Medical Documents' : 'Administrative Documents',
          description: type === 'medical' ? 'Medical records and health-related documents' : 'Administrative and legal documents',
          type: 'system_root',
          isSystemRoot: true,
          systemRootType: type,
          createdByUserId: userId,
        });

        // Verify creation by fetching again
        const verified = await this.getSystemRootFolder(householdId, type);
        if (!verified) {
          throw new Error(`Failed to create system root folder of type ${type} for household ${householdId}`);
        }
      }
    }
  }

  async softDeleteDocument(documentId: string, householdId: string): Promise<void> {
    // Already implemented as deleteDocument
    return this.deleteDocument(documentId, householdId);
  }

  async restoreDocument(documentId: string, householdId: string): Promise<void> {
    const now = nowIso();
    const result = await this.pool.query(
      `UPDATE documents
       SET deleted_at = NULL, updated_at = $1
       WHERE id = $2 AND household_id = $3 AND deleted_at IS NOT NULL`,
      [now, documentId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Deleted document not found.');
    }
  }
}
