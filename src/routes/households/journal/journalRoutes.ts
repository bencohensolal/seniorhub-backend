import type { FastifyInstance } from 'fastify';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { ListJournalEntriesUseCase } from '../../../domain/usecases/journal/ListJournalEntriesUseCase.js';
import type { CreateJournalEntryUseCase } from '../../../domain/usecases/journal/CreateJournalEntryUseCase.js';
import type { UpdateJournalEntryUseCase } from '../../../domain/usecases/journal/UpdateJournalEntryUseCase.js';
import type { DeleteJournalEntryUseCase } from '../../../domain/usecases/journal/DeleteJournalEntryUseCase.js';
import { paramsSchema, errorResponseSchema } from '../householdSchemas.js';
import {
  createJournalEntryBodySchema,
  updateJournalEntryBodySchema,
  journalEntryParamsSchema,
  listJournalEntriesQuerySchema,
} from './journalSchemas.js';
import { handleDomainError } from '../../errorHandler.js';
import { ensureHouseholdPermission, getRequesterContext } from '../utils.js';
import { requireWritePermission } from '../../../plugins/authContext.js';

export function registerJournalRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  useCases: {
    listJournalEntriesUseCase: ListJournalEntriesUseCase;
    createJournalEntryUseCase: CreateJournalEntryUseCase;
    updateJournalEntryUseCase: UpdateJournalEntryUseCase;
    deleteJournalEntryUseCase: DeleteJournalEntryUseCase;
  },
  journalRepository?: import('../../../domain/repositories/JournalEntryRepository.js').JournalEntryRepository,
): void {
  // GET /v1/households/:householdId/journal - List journal entries
  fastify.get(
    '/v1/households/:householdId/journal',
    {
      schema: {
        tags: ['Journal'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        querystring: {
          type: 'object',
          properties: {
            seniorId: { type: 'string' },
            category: { type: 'string', enum: ['general', 'mood', 'meal', 'outing', 'visit', 'incident', 'care', 'other'] },
            archived: { type: 'string', enum: ['true', 'false'] },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
            offset: { type: 'integer', minimum: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
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
      const queryResult = listJournalEntriesQuerySchema.safeParse(request.query);

      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const filters = queryResult.data;
        const journalFilters = {
          ...(filters.seniorId && { seniorId: filters.seniorId }),
          ...(filters.category && { category: filters.category }),
          ...(filters.archived !== undefined && { archived: filters.archived }),
          ...(filters.limit && { limit: filters.limit }),
          ...(filters.offset !== undefined && { offset: filters.offset }),
        };

        const entries = await useCases.listJournalEntriesUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          filters: journalFilters,
        });

        return reply.status(200).send({
          status: 'success',
          data: entries,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/journal - Create journal entry
  fastify.post(
    '/v1/households/:householdId/journal',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Journal'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          properties: {
            seniorIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
            content: { type: 'string', minLength: 1, maxLength: 5000 },
            description: { type: 'string', maxLength: 10000 },
            category: { type: 'string', enum: ['general', 'mood', 'meal', 'outing', 'visit', 'incident', 'care', 'other'] },
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
      const bodyResult = createJournalEntryBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageJournal');
        const body = bodyResult.data;

        const entry = await useCases.createJournalEntryUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          seniorIds: body.seniorIds,
          content: body.content,
          ...(body.description !== undefined && { description: body.description }),
          ...(body.category !== undefined && { category: body.category }),
        });

        return reply.status(201).send({
          status: 'success',
          data: entry,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/journal/:entryId - Update journal entry
  fastify.patch(
    '/v1/households/:householdId/journal/:entryId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Journal'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            entryId: { type: 'string' },
          },
          required: ['householdId', 'entryId'],
        },
        body: {
          type: 'object',
          properties: {
            seniorIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
            content: { type: 'string', minLength: 1, maxLength: 5000 },
            description: { type: ['string', 'null'], maxLength: 10000 },
            category: { type: 'string', enum: ['general', 'mood', 'meal', 'outing', 'visit', 'incident', 'care', 'other'] },
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
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = journalEntryParamsSchema.safeParse(request.params);
      const bodyResult = updateJournalEntryBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageJournal');
        const body = bodyResult.data;

        const updates: Record<string, unknown> = {};
        if (body.seniorIds !== undefined) updates.seniorIds = body.seniorIds;
        if (body.content !== undefined) updates.content = body.content;
        if (body.description !== undefined) updates.description = body.description;
        if (body.category !== undefined) updates.category = body.category;

        const entry = await useCases.updateJournalEntryUseCase.execute({
          entryId: paramsResult.data.entryId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          updates,
        });

        return reply.status(200).send({
          status: 'success',
          data: entry,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/journal/:entryId/archive - Archive journal entry
  fastify.post(
    '/v1/households/:householdId/journal/:entryId/archive',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Journal'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' }, entryId: { type: 'string' } },
          required: ['householdId', 'entryId'],
        },
        response: {
          200: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', additionalProperties: true } }, required: ['status', 'data'] },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = journalEntryParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }
      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageJournal');
        const entry = await journalRepository!.archive(paramsResult.data.entryId);
        return reply.status(200).send({ status: 'success', data: entry });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/journal/:entryId/unarchive - Unarchive journal entry
  fastify.post(
    '/v1/households/:householdId/journal/:entryId/unarchive',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Journal'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' }, entryId: { type: 'string' } },
          required: ['householdId', 'entryId'],
        },
        response: {
          200: { type: 'object', properties: { status: { type: 'string' }, data: { type: 'object', additionalProperties: true } }, required: ['status', 'data'] },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = journalEntryParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }
      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageJournal');
        const entry = await journalRepository!.unarchive(paramsResult.data.entryId);
        return reply.status(200).send({ status: 'success', data: entry });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/journal/:entryId - Delete journal entry
  fastify.delete(
    '/v1/households/:householdId/journal/:entryId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Journal'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            entryId: { type: 'string' },
          },
          required: ['householdId', 'entryId'],
        },
        response: {
          204: {
            type: 'null',
            description: 'Journal entry deleted successfully',
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = journalEntryParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'deleteJournal');
        await useCases.deleteJournalEntryUseCase.execute({
          entryId: paramsResult.data.entryId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(204).send();
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
