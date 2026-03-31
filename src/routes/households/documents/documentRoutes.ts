import type { FastifyInstance } from 'fastify';
import type { MultipartFields } from '@fastify/multipart';
import multipart from '@fastify/multipart';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { ListDocumentRootsUseCase } from '../../../domain/usecases/documents/ListDocumentRootsUseCase.js';
import type { ListFolderContentUseCase } from '../../../domain/usecases/documents/ListFolderContentUseCase.js';
import type { CreateFolderUseCase } from '../../../domain/usecases/documents/CreateFolderUseCase.js';
import type { UpdateFolderUseCase } from '../../../domain/usecases/documents/UpdateFolderUseCase.js';
import type { DeleteFolderUseCase } from '../../../domain/usecases/documents/DeleteFolderUseCase.js';
import type { CreateDocumentUseCase } from '../../../domain/usecases/documents/CreateDocumentUseCase.js';
import type { UpdateDocumentUseCase } from '../../../domain/usecases/documents/UpdateDocumentUseCase.js';
import type { DeleteDocumentUseCase } from '../../../domain/usecases/documents/DeleteDocumentUseCase.js';
import type { SearchDocumentsUseCase } from '../../../domain/usecases/documents/SearchDocumentsUseCase.js';
import type { MoveToTrashUseCase } from '../../../domain/usecases/documents/MoveToTrashUseCase.js';
import type { RestoreFromTrashUseCase } from '../../../domain/usecases/documents/RestoreFromTrashUseCase.js';
import type { PurgeExpiredTrashUseCase } from '../../../domain/usecases/documents/PurgeExpiredTrashUseCase.js';
import type { PermanentlyDeleteFromTrashUseCase } from '../../../domain/usecases/documents/PermanentlyDeleteFromTrashUseCase.js';
import type { GetStorageStatsUseCase } from '../../../domain/usecases/documents/GetStorageStatsUseCase.js';
import type { GetDocumentDownloadUrlUseCase } from '../../../domain/usecases/documents/GetDocumentDownloadUrlUseCase.js';
import { createStorageService } from '../../../data/services/storage/createStorageService.js';
import { paramsSchema, errorResponseSchema } from '../householdSchemas.js';
import {
  createDocumentFolderBodySchema,
  updateDocumentFolderBodySchema,
  documentFolderParamsSchema,
  listFoldersByParentQuerySchema,
  createDocumentBodySchema,
  updateDocumentBodySchema,
  documentParamsSchema,
  listDocumentsByFolderQuerySchema,
  searchDocumentsQuerySchema,
  documentFolderResponseSchema,
  documentResponseSchema,
  documentRootsResponseSchema,
  searchDocumentsResponseSchema,
} from './documentSchemas.js';
import { handleDomainError } from '../../errorHandler.js';
import { requireWritePermission } from '../../../plugins/authContext.js';
import { ensureHouseholdPermission, verifyTabletHouseholdAccess, getRequesterContext } from '../utils.js';

export function registerDocumentRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  useCases: {
    listDocumentRootsUseCase: ListDocumentRootsUseCase;
    listFolderContentUseCase: ListFolderContentUseCase;
    createFolderUseCase: CreateFolderUseCase;
    updateFolderUseCase: UpdateFolderUseCase;
    deleteFolderUseCase: DeleteFolderUseCase;
    createDocumentUseCase: CreateDocumentUseCase;
    updateDocumentUseCase: UpdateDocumentUseCase;
    deleteDocumentUseCase: DeleteDocumentUseCase;
    searchDocumentsUseCase: SearchDocumentsUseCase;
    moveToTrashUseCase: MoveToTrashUseCase;
    restoreFromTrashUseCase: RestoreFromTrashUseCase;
    purgeExpiredTrashUseCase: PurgeExpiredTrashUseCase;
    permanentlyDeleteFromTrashUseCase: PermanentlyDeleteFromTrashUseCase;
    getStorageStatsUseCase: GetStorageStatsUseCase;
    getDocumentDownloadUrlUseCase: GetDocumentDownloadUrlUseCase;
  },
): void {
  // GET /v1/households/:householdId/documents/roots - List system roots and senior folders
  fastify.get(
    '/v1/households/:householdId/documents/roots',
    {
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object', additionalProperties: true },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        // Verify tablet can only access its own household
        verifyTabletHouseholdAccess(request, reply, paramsResult.data.householdId);

        const result = await useCases.listDocumentRootsUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(200).send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // GET /v1/households/:householdId/documents/folders - List folders by parent
  fastify.get(
    '/v1/households/:householdId/documents/folders',
    {
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        querystring: {
          type: 'object',
          properties: {
            parentFolderId: { type: 'string', nullable: true },
            limit: { type: 'integer', minimum: 1, maximum: 200 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  folders: { type: 'array', items: { type: 'object', additionalProperties: true } },
                  documents: { type: 'array', items: { type: 'object', additionalProperties: true } },
                },
                required: ['folders', 'documents'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const queryResult = listFoldersByParentQuerySchema.safeParse(request.query);
      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        verifyTabletHouseholdAccess(request, reply, paramsResult.data.householdId);
        const query = request.query as { limit?: number; offset?: number };

        const result = await useCases.listFolderContentUseCase.execute({
          householdId: paramsResult.data.householdId,
          folderId: queryResult.data.parentFolderId ?? null,
          requester: getRequesterContext(request),
          ...(query.limit !== undefined && { limit: query.limit }),
          ...(query.offset !== undefined && { offset: query.offset }),
        });

        return reply.status(200).send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/documents/folders - Create folder (WRITE - tablets blocked)
  fastify.post(
    '/v1/households/:householdId/documents/folders',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            parentFolderId: { type: ['string', 'null'] },
            seniorId: { type: ['string', 'null'] },
            name: { type: 'string', minLength: 1, maxLength: 200 },
            description: { type: ['string', 'null'], maxLength: 1000 },
            isSystemRoot: { type: 'boolean' },
            systemRootType: { type: ['string', 'null'], enum: ['personal', 'administrative'] },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object', additionalProperties: true },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const bodyResult = createDocumentFolderBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const folder = await useCases.createFolderUseCase.execute({
          ...bodyResult.data,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(201).send({
          status: 'success',
          data: folder,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/documents/folders/:folderId - Update folder (WRITE - tablets blocked)
  fastify.patch(
    '/v1/households/:householdId/documents/folders/:folderId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          required: ['householdId', 'folderId'],
          properties: {
            householdId: { type: 'string' },
            folderId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            description: { type: ['string', 'null'], maxLength: 1000 },
            parentFolderId: { type: ['string', 'null'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object', additionalProperties: true },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = documentFolderParamsSchema.safeParse(request.params);
      const bodyResult = updateDocumentFolderBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const folder = await useCases.updateFolderUseCase.execute({
          folderId: paramsResult.data.folderId,
          householdId: paramsResult.data.householdId,
          updates: bodyResult.data,
          requester: getRequesterContext(request),
        });

        return reply.status(200).send({
          status: 'success',
          data: folder,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/documents/folders/:folderId - Delete folder (WRITE - tablets blocked)
  fastify.delete(
    '/v1/households/:householdId/documents/folders/:folderId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          required: ['householdId', 'folderId'],
          properties: {
            householdId: { type: 'string' },
            folderId: { type: 'string' },
          },
        },
        response: {
          204: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
            },
            required: ['status'],
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = documentFolderParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await useCases.deleteFolderUseCase.execute({
          folderId: paramsResult.data.folderId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(204).send({
          status: 'success',
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/documents - Create document (WRITE - tablets blocked)
  fastify.post(
    '/v1/households/:householdId/documents',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          required: ['folderId', 'name', 'originalFilename', 'storageKey', 'mimeType', 'fileSizeBytes', 'extension'],
          properties: {
            folderId: { type: 'string' },
            seniorId: { type: ['string', 'null'] },
            name: { type: 'string', minLength: 1, maxLength: 200 },
            originalFilename: { type: 'string', minLength: 1, maxLength: 500 },
            storageKey: { type: 'string', minLength: 1, maxLength: 500 },
            mimeType: { type: 'string', minLength: 1, maxLength: 100 },
            fileSizeBytes: { type: 'number', minimum: 1, maximum: 100 * 1024 * 1024 },
            extension: { type: 'string', maxLength: 20 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object', additionalProperties: true },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const bodyResult = createDocumentBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const document = await useCases.createDocumentUseCase.execute({
          ...bodyResult.data,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(201).send({
          status: 'success',
          data: document,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/documents/:documentId - Update document (WRITE - tablets blocked)
  fastify.patch(
    '/v1/households/:householdId/documents/:documentId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          required: ['householdId', 'documentId'],
          properties: {
            householdId: { type: 'string' },
            documentId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            folderId: { type: 'string' },
            seniorId: { type: ['string', 'null'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object', additionalProperties: true },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = documentParamsSchema.safeParse(request.params);
      const bodyResult = updateDocumentBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const document = await useCases.updateDocumentUseCase.execute({
          documentId: paramsResult.data.documentId,
          householdId: paramsResult.data.householdId,
          updates: bodyResult.data,
          requester: getRequesterContext(request),
        });

        return reply.status(200).send({
          status: 'success',
          data: document,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/documents/:documentId - Delete document (WRITE - tablets blocked)
  fastify.delete(
    '/v1/households/:householdId/documents/:documentId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          required: ['householdId', 'documentId'],
          properties: {
            householdId: { type: 'string' },
            documentId: { type: 'string' },
          },
        },
        response: {
          204: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
            },
            required: ['status'],
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = documentParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await useCases.deleteDocumentUseCase.execute({
          documentId: paramsResult.data.documentId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(204).send({
          status: 'success',
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/documents/upload - Upload document file (multipart)
  // Wrapped in a scoped plugin so @fastify/multipart can be registered for this route
  void fastify.register(async (scope) => {
    await scope.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

    scope.post(
      '/v1/households/:householdId/documents/upload',
      { preHandler: requireWritePermission },
      async (request, reply) => {
        const paramsResult = paramsSchema.safeParse(request.params);
        if (!paramsResult.success) {
          return reply.status(400).send({ status: 'error', message: 'Invalid householdId.' });
        }
        const { householdId } = paramsResult.data;

        const data = await request.file({ limits: { fileSize: 50 * 1024 * 1024 } });
        if (!data) {
          return reply.status(400).send({ status: 'error', message: 'No file provided.' });
        }

        const fileBuffer = await data.toBuffer();
        const mimeType = data.mimetype;
        const originalFilename = data.filename || 'document';
        const fields = data.fields as MultipartFields;
        const folderId = (fields.folderId as { value?: string })?.value;
        const name = (fields.name as { value?: string })?.value || originalFilename;
        const seniorId = (fields.seniorId as { value?: string })?.value || null;

        if (!folderId) {
          return reply.status(400).send({ status: 'error', message: 'folderId is required.' });
        }

        const extension = originalFilename.split('.').pop()?.toUpperCase() ?? '';
        const fileSizeBytes = fileBuffer.length;

        // Enforce storage quota before uploading
        try {
          const stats = await repository.getStorageStats(householdId);
          if (stats.usedBytes + fileSizeBytes > stats.quotaBytes) {
            return reply.status(413).send({
              status: 'error',
              message: `Storage quota exceeded. Used: ${stats.usedBytes} / ${stats.quotaBytes} bytes.`,
            });
          }
        } catch { /* non-blocking: proceed if stats fail */ }

        try {
          const storageService = createStorageService();
          const { key: storageKey } = await storageService.uploadDocument({
            buffer: fileBuffer,
            mimeType,
            householdId,
            documentId: crypto.randomUUID(),
            originalFilename,
            extension: extension.toLowerCase(),
          });

          const document = await useCases.createDocumentUseCase.execute({
            householdId,
            folderId,
            seniorId: seniorId ?? null,
            name,
            originalFilename,
            storageKey,
            mimeType,
            fileSizeBytes,
            extension,
            requester: getRequesterContext(request),
          });

          return reply.status(201).send({ status: 'success', data: document });
        } catch (error) {
          return handleDomainError(error, reply);
        }
      },
    );
  });

  // POST /v1/households/:householdId/documents/trash/move - Move item to trash
  fastify.post(
    '/v1/households/:householdId/documents/trash/move',
    { preHandler: requireWritePermission },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const body = request.body as { itemId?: string; itemType?: string };
      if (!paramsResult.success || !body.itemId || !['folder', 'document'].includes(body.itemType ?? '')) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }
      try {
        await useCases.moveToTrashUseCase.execute({
          householdId: paramsResult.data.householdId,
          itemId: body.itemId,
          itemType: body.itemType as 'folder' | 'document',
          requester: getRequesterContext(request),
        });
        return reply.status(204).send({ status: 'success' });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/documents/trash/restore - Restore item from trash
  fastify.post(
    '/v1/households/:householdId/documents/trash/restore',
    { preHandler: requireWritePermission },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const body = request.body as { itemId?: string; itemType?: string };
      if (!paramsResult.success || !body.itemId || !['folder', 'document'].includes(body.itemType ?? '')) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }
      try {
        await useCases.restoreFromTrashUseCase.execute({
          householdId: paramsResult.data.householdId,
          itemId: body.itemId,
          itemType: body.itemType as 'folder' | 'document',
          requester: getRequesterContext(request),
        });
        return reply.status(204).send({ status: 'success' });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/documents/trash/delete - Permanently delete a trashed item
  fastify.post(
    '/v1/households/:householdId/documents/trash/delete',
    { preHandler: requireWritePermission },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const body = request.body as { itemId?: string; itemType?: string };
      if (!paramsResult.success || !body.itemId || !['folder', 'document'].includes(body.itemType ?? '')) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }
      try {
        await useCases.permanentlyDeleteFromTrashUseCase.execute({
          householdId: paramsResult.data.householdId,
          itemId: body.itemId,
          itemType: body.itemType as 'folder' | 'document',
          requester: getRequesterContext(request),
        });
        return reply.status(204).send({ status: 'success' });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/documents/trash - Purge expired trash items
  fastify.delete(
    '/v1/households/:householdId/documents/trash',
    { preHandler: requireWritePermission },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }
      try {
        const result = await useCases.purgeExpiredTrashUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });
        return reply.status(200).send({ status: 'success', data: result });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // GET /v1/households/:householdId/documents/storage-stats
  fastify.get(
    '/v1/households/:householdId/documents/storage-stats',
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }
      try {
        verifyTabletHouseholdAccess(request, reply, paramsResult.data.householdId);
        const result = await useCases.getStorageStatsUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });
        return reply.status(200).send({ status: 'success', data: result });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // GET /v1/households/:householdId/documents/search - Search documents and folders
  fastify.get(
    '/v1/households/:householdId/documents/search',
    {
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        querystring: {
          type: 'object',
          properties: { query: { type: 'string', minLength: 1, maxLength: 100 } },
          required: ['query'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object', additionalProperties: true },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const queryResult = searchDocumentsQuerySchema.safeParse(request.query);
      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        verifyTabletHouseholdAccess(request, reply, paramsResult.data.householdId);

        const result = await useCases.searchDocumentsUseCase.execute({
          householdId: paramsResult.data.householdId,
          query: queryResult.data.query,
          folderId: queryResult.data.folderId ?? null,
          requester: getRequesterContext(request),
        });

        return reply.status(200).send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // GET /v1/households/:householdId/documents/:documentId/download-url
  fastify.get(
    '/v1/households/:householdId/documents/:documentId/download-url',
    {
      schema: {
        tags: ['Documents'],
        params: {
          type: 'object',
          required: ['householdId', 'documentId'],
          properties: {
            householdId: { type: 'string' },
            documentId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  filename: { type: 'string' },
                  mimeType: { type: 'string' },
                },
                required: ['url', 'filename', 'mimeType'],
              },
            },
            required: ['status', 'data'],
          },
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = documentParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(403).send({ status: 'error', message: 'Invalid request payload.' });
      }

      try {
        const result = await useCases.getDocumentDownloadUrlUseCase.execute({
          documentId: paramsResult.data.documentId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(200).send({ status: 'success', data: result });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
