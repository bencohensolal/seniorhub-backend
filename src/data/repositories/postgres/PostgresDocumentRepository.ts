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
       WHERE id = $${paramIndex} AND household_id = $${paramIndex + 1} AND deleted_at IS NULL
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
      description: string | null;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      event_date: string | Date | null;
      category: string | null;
      tags: string[] | null;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `SELECT id, household_id, folder_id, senior_id, name, description, original_filename,
              storage_key, mime_type, file_size_bytes, extension, event_date, category, tags,
              uploaded_by_user_id, uploaded_at, updated_at, deleted_at
       FROM documents
       WHERE id = $1 AND household_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [documentId, householdId],
    );

    const row = result.rows[0];
    return row ? mapDocument(row) : null;
  }

  async listDocumentsByFolder(householdId: string, folderId: string): Promise<Document[]> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      folder_id: string;
      senior_id: string | null;
      name: string;
      description: string | null;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      event_date: string | Date | null;
      category: string | null;
      tags: string[] | null;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `SELECT id, household_id, folder_id, senior_id, name, description, original_filename,
              storage_key, mime_type, file_size_bytes, extension, event_date, category, tags,
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
      description: string | null;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      event_date: string | Date | null;
      category: string | null;
      tags: string[] | null;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `INSERT INTO documents (
         id, household_id, folder_id, senior_id, name, description, original_filename,
         storage_key, mime_type, file_size_bytes, extension, event_date, category, tags,
         uploaded_by_user_id, uploaded_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
       RETURNING id, household_id, folder_id, senior_id, name, description, original_filename,
                 storage_key, mime_type, file_size_bytes, extension, event_date, category, tags,
                 uploaded_by_user_id, uploaded_at, updated_at, deleted_at`,
      [
        id,
        input.householdId,
        input.folderId,
        input.seniorId ?? null,
        input.name,
        input.description ?? null,
        input.originalFilename,
        input.storageKey,
        input.mimeType,
        input.fileSizeBytes,
        input.extension,
        input.eventDate ?? null,
        input.category ?? null,
        input.tags ?? [],
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
    const values: (string | number | null | string[])[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.folderId !== undefined) {
      updates.push(`folder_id = $${paramIndex++}`);
      values.push(input.folderId);
    }
    if (input.seniorId !== undefined) {
      updates.push(`senior_id = $${paramIndex++}`);
      values.push(input.seniorId);
    }
    if (input.eventDate !== undefined) {
      updates.push(`event_date = $${paramIndex++}`);
      values.push(input.eventDate);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }
    if (input.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(input.tags);
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
      description: string | null;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      event_date: string | Date | null;
      category: string | null;
      tags: string[] | null;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `UPDATE documents
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND household_id = $${paramIndex + 1} AND deleted_at IS NULL
       RETURNING id, household_id, folder_id, senior_id, name, description, original_filename,
                 storage_key, mime_type, file_size_bytes, extension, event_date, category, tags,
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

  async searchDocumentsAndFolders(householdId: string, query: string, folderId?: string | null): Promise<{
    documents: Document[];
    folders: DocumentFolder[];
  }> {
    const searchPattern = `%${query}%`;

    // When a folderId is given, use a recursive CTE to collect all descendant folder IDs
    // so the search covers the subtree rooted at that folder.
    const folderFilter = folderId
      ? `AND folder_id IN (
           WITH RECURSIVE subtree AS (
             SELECT id FROM document_folders WHERE id = $3 AND household_id = $1 AND deleted_at IS NULL
             UNION ALL
             SELECT df.id FROM document_folders df
             JOIN subtree s ON df.parent_folder_id = s.id
             WHERE df.household_id = $1 AND df.deleted_at IS NULL
           )
           SELECT id FROM subtree
         )`
      : '';

    const folderFolderFilter = folderId
      ? `AND (id = $3 OR parent_folder_id IN (
           WITH RECURSIVE subtree AS (
             SELECT id FROM document_folders WHERE id = $3 AND household_id = $1 AND deleted_at IS NULL
             UNION ALL
             SELECT df.id FROM document_folders df
             JOIN subtree s ON df.parent_folder_id = s.id
             WHERE df.household_id = $1 AND df.deleted_at IS NULL
           )
           SELECT id FROM subtree
         ))`
      : '';

    const baseParams: (string | number)[] = folderId
      ? [householdId, searchPattern, folderId]
      : [householdId, searchPattern];

    const documentsResult = await this.pool.query<{
      id: string;
      household_id: string;
      folder_id: string;
      senior_id: string | null;
      name: string;
      description: string | null;
      original_filename: string;
      storage_key: string;
      mime_type: string;
      file_size_bytes: number;
      extension: string;
      event_date: string | Date | null;
      category: string | null;
      tags: string[] | null;
      uploaded_by_user_id: string;
      uploaded_at: string | Date;
      updated_at: string | Date;
      deleted_at: string | Date | null;
    }>(
      `SELECT id, household_id, folder_id, senior_id, name, description, original_filename,
              storage_key, mime_type, file_size_bytes, extension, event_date, category, tags,
              uploaded_by_user_id, uploaded_at, updated_at, deleted_at
       FROM documents
       WHERE household_id = $1 AND deleted_at IS NULL AND trashed_at IS NULL
         AND (name ILIKE $2 OR original_filename ILIKE $2 OR description ILIKE $2)
         ${folderFilter}
       ORDER BY uploaded_at DESC`,
      baseParams,
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
       WHERE household_id = $1 AND deleted_at IS NULL AND trashed_at IS NULL
         AND (name ILIKE $2 OR description ILIKE $2)
         ${folderFolderFilter}
       ORDER BY name ASC`,
      baseParams,
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

  async getSystemRootFolder(householdId: string, systemRootType: 'medical' | 'administrative' | 'trash'): Promise<DocumentFolderWithCounts | null> {
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
    const roots: Array<{ type: 'medical' | 'administrative' | 'trash'; name: string; description: string }> = [
      { type: 'medical', name: 'Medical Documents', description: 'Medical records and health-related documents' },
      { type: 'administrative', name: 'Administrative Documents', description: 'Administrative and legal documents' },
      { type: 'trash', name: 'Trash', description: 'Deleted items — automatically purged after 30 days.' },
    ];

    for (const root of roots) {
      const existing = await this.getSystemRootFolder(householdId, root.type);
      if (!existing) {
        await this.createDocumentFolder({
          householdId,
          parentFolderId: null,
          name: root.name,
          description: root.description,
          type: 'system_root',
          isSystemRoot: true,
          systemRootType: root.type,
          createdByUserId: userId,
        });

        const verified = await this.getSystemRootFolder(householdId, root.type);
        if (!verified) {
          throw new Error(`Failed to create system root folder of type ${root.type} for household ${householdId}`);
        }
      }
    }
  }

  async ensureSeniorFoldersForHousehold(householdId: string, medicalRootId: string, userId: string): Promise<void> {
    const result = await this.pool.query<{ member_id: string; first_name: string; last_name: string }>(
      `SELECT hm.id AS member_id, hm.first_name, hm.last_name
       FROM household_members hm
       WHERE hm.household_id = $1
         AND hm.role = 'senior'
         AND hm.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM document_folders df
           WHERE df.household_id = $1
             AND df.senior_id = hm.id
             AND df.deleted_at IS NULL
         )`,
      [householdId],
    );

    for (const row of result.rows) {
      await this.createDocumentFolder({
        householdId,
        parentFolderId: medicalRootId,
        seniorId: row.member_id,
        name: `${row.first_name} ${row.last_name}`,
        description: null,
        createdByUserId: userId,
      });
    }
  }

  async moveDocumentFolderToTrash(folderId: string, householdId: string, trashFolderId: string): Promise<void> {
    const now = nowIso();
    const result = await this.pool.query(
      `UPDATE document_folders
       SET parent_folder_id = $1, trashed_at = $2, original_parent_folder_id = parent_folder_id, updated_at = $2
       WHERE id = $3 AND household_id = $4 AND deleted_at IS NULL AND trashed_at IS NULL`,
      [trashFolderId, now, folderId, householdId],
    );
    if (result.rowCount === 0) {
      throw new Error('Folder not found or already trashed.');
    }
  }

  async moveDocumentToTrash(documentId: string, householdId: string, trashFolderId: string): Promise<void> {
    const now = nowIso();
    const result = await this.pool.query(
      `UPDATE documents
       SET folder_id = $1, trashed_at = $2, original_folder_id = folder_id, updated_at = $2
       WHERE id = $3 AND household_id = $4 AND deleted_at IS NULL AND trashed_at IS NULL`,
      [trashFolderId, now, documentId, householdId],
    );
    if (result.rowCount === 0) {
      throw new Error('Document not found or already trashed.');
    }
  }

  async restoreDocumentFolderFromTrash(folderId: string, householdId: string): Promise<void> {
    const now = nowIso();
    const result = await this.pool.query(
      `UPDATE document_folders
       SET parent_folder_id = original_parent_folder_id, trashed_at = NULL, original_parent_folder_id = NULL, updated_at = $1
       WHERE id = $2 AND household_id = $3 AND deleted_at IS NULL AND trashed_at IS NOT NULL`,
      [now, folderId, householdId],
    );
    if (result.rowCount === 0) {
      throw new Error('Folder not found or not in trash.');
    }
  }

  async restoreDocumentFromTrash(documentId: string, householdId: string): Promise<void> {
    const now = nowIso();
    const result = await this.pool.query(
      `UPDATE documents
       SET folder_id = original_folder_id, trashed_at = NULL, original_folder_id = NULL, updated_at = $1
       WHERE id = $2 AND household_id = $3 AND deleted_at IS NULL AND trashed_at IS NOT NULL`,
      [now, documentId, householdId],
    );
    if (result.rowCount === 0) {
      throw new Error('Document not found or not in trash.');
    }
  }

  async purgeExpiredTrashItems(householdId: string, retentionDays: number): Promise<{ folders: number; documents: number }> {
    const now = nowIso();

    // Find all expired trash folders recursively (including their descendants)
    const expiredFoldersResult = await this.pool.query<{ id: string }>(
      `WITH RECURSIVE trash_tree AS (
         SELECT id FROM document_folders
         WHERE household_id = $1
           AND trashed_at IS NOT NULL
           AND deleted_at IS NULL
           AND trashed_at < NOW() - ($2 || ' days')::INTERVAL
         UNION ALL
         SELECT df.id FROM document_folders df
         INNER JOIN trash_tree tt ON df.parent_folder_id = tt.id
         WHERE df.deleted_at IS NULL
       )
       SELECT id FROM trash_tree`,
      [householdId, retentionDays],
    );

    const expiredFolderIds = expiredFoldersResult.rows.map((r) => r.id);
    let purgedFolders = 0;
    let purgedDocuments = 0;

    if (expiredFolderIds.length > 0) {
      // Soft-delete documents inside expired folders
      const docsResult = await this.pool.query(
        `UPDATE documents SET deleted_at = $1 WHERE folder_id = ANY($2) AND deleted_at IS NULL`,
        [now, expiredFolderIds],
      );
      purgedDocuments += docsResult.rowCount ?? 0;

      // Soft-delete expired folders
      const foldersResult = await this.pool.query(
        `UPDATE document_folders SET deleted_at = $1 WHERE id = ANY($2) AND deleted_at IS NULL`,
        [now, expiredFolderIds],
      );
      purgedFolders += foldersResult.rowCount ?? 0;
    }

    // Soft-delete directly trashed documents past retention
    const directDocsResult = await this.pool.query(
      `UPDATE documents SET deleted_at = $1
       WHERE household_id = $2
         AND trashed_at IS NOT NULL
         AND deleted_at IS NULL
         AND trashed_at < NOW() - ($3 || ' days')::INTERVAL`,
      [now, householdId, retentionDays],
    );
    purgedDocuments += directDocsResult.rowCount ?? 0;

    return { folders: purgedFolders, documents: purgedDocuments };
  }

  async softDeleteDocument(documentId: string, householdId: string): Promise<void> {
    // Already implemented as deleteDocument
    return this.deleteDocument(documentId, householdId);
  }

  async hardDeleteDocument(documentId: string, householdId: string): Promise<{ storageKey: string }> {
    const result = await this.pool.query<{ storage_key: string }>(
      `DELETE FROM documents WHERE id = $1 AND household_id = $2 RETURNING storage_key`,
      [documentId, householdId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Document not found.');
    }
    return { storageKey: row.storage_key };
  }

  async hardDeleteDocumentFolder(folderId: string, householdId: string): Promise<{ storageKeys: string[] }> {
    // Collect all descendant folder IDs (including the root)
    const folderIdsResult = await this.pool.query<{ id: string }>(
      `WITH RECURSIVE subtree AS (
         SELECT id FROM document_folders WHERE id = $1 AND household_id = $2
         UNION ALL
         SELECT df.id FROM document_folders df
         JOIN subtree s ON df.parent_folder_id = s.id
         WHERE df.household_id = $2
       )
       SELECT id FROM subtree`,
      [folderId, householdId],
    );

    const folderIds = folderIdsResult.rows.map((r) => r.id);
    if (folderIds.length === 0) {
      throw new NotFoundError('Folder not found.');
    }

    // Hard-delete all documents in the subtree, capture storage keys
    const docsResult = await this.pool.query<{ storage_key: string }>(
      `DELETE FROM documents WHERE folder_id = ANY($1) AND household_id = $2 RETURNING storage_key`,
      [folderIds, householdId],
    );
    const storageKeys = docsResult.rows.map((r) => r.storage_key);

    // Hard-delete all folders in the subtree
    await this.pool.query(
      `DELETE FROM document_folders WHERE id = ANY($1) AND household_id = $2`,
      [folderIds, householdId],
    );

    return { storageKeys };
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
