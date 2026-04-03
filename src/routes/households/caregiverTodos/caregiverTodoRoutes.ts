import type { FastifyInstance } from 'fastify';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { ListCaregiverTodosUseCase } from '../../../domain/usecases/caregiverTodos/ListCaregiverTodosUseCase.js';
import type { CreateCaregiverTodoUseCase } from '../../../domain/usecases/caregiverTodos/CreateCaregiverTodoUseCase.js';
import type { UpdateCaregiverTodoUseCase } from '../../../domain/usecases/caregiverTodos/UpdateCaregiverTodoUseCase.js';
import type { DeleteCaregiverTodoUseCase } from '../../../domain/usecases/caregiverTodos/DeleteCaregiverTodoUseCase.js';
import type { CompleteCaregiverTodoUseCase } from '../../../domain/usecases/caregiverTodos/CompleteCaregiverTodoUseCase.js';
import type { NudgeCaregiverTodoUseCase } from '../../../domain/usecases/caregiverTodos/NudgeCaregiverTodoUseCase.js';
import type { AddCaregiverTodoCommentUseCase } from '../../../domain/usecases/caregiverTodos/AddCaregiverTodoCommentUseCase.js';
import { paramsSchema, errorResponseSchema } from '../householdSchemas.js';
import {
  createCaregiverTodoBodySchema,
  updateCaregiverTodoBodySchema,
  caregiverTodoParamsSchema,
  listCaregiverTodosQuerySchema,
  addCommentBodySchema,
} from './caregiverTodoSchemas.js';
import { handleDomainError } from '../../errorHandler.js';
import { ensureHouseholdPermission, getRequesterContext } from '../utils.js';
import { requireWritePermission } from '../../../plugins/authContext.js';
import { logAudit } from '../auditHelper.js';

export function registerCaregiverTodoRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  useCases: {
    listCaregiverTodosUseCase: ListCaregiverTodosUseCase;
    createCaregiverTodoUseCase: CreateCaregiverTodoUseCase;
    updateCaregiverTodoUseCase: UpdateCaregiverTodoUseCase;
    deleteCaregiverTodoUseCase: DeleteCaregiverTodoUseCase;
    completeCaregiverTodoUseCase: CompleteCaregiverTodoUseCase;
    nudgeCaregiverTodoUseCase: NudgeCaregiverTodoUseCase;
    addCaregiverTodoCommentUseCase: AddCaregiverTodoCommentUseCase;
  },
): void {
  // GET /v1/households/:householdId/caregiver-todos - List caregiver todos
  fastify.get(
    '/v1/households/:householdId/caregiver-todos',
    {
      schema: {
        tags: ['Caregiver Todos'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
            assignedTo: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'array' },
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
      const queryResult = listCaregiverTodosQuerySchema.safeParse(request.query);

      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const filters = queryResult.data;
        const todoFilters: {
          status?: string;
          assignedTo?: string;
        } = {};
        if (filters.status) todoFilters.status = filters.status;
        if (filters.assignedTo) todoFilters.assignedTo = filters.assignedTo;

        const todos = await useCases.listCaregiverTodosUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          filters: todoFilters,
        });

        return reply.status(200).send({
          status: 'success',
          data: todos,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/caregiver-todos - Create caregiver todo
  fastify.post(
    '/v1/households/:householdId/caregiver-todos',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Caregiver Todos'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
            priority: { type: 'string', enum: ['low', 'normal', 'high'] },
            assignedTo: { type: 'string' },
            dueDate: { type: 'string' },
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
      const bodyResult = createCaregiverTodoBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageCaregiverTodos');
        const body = bodyResult.data;

        const todo = await useCases.createCaregiverTodoUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          title: body.title,
          ...(body.description !== undefined && { description: body.description }),
          ...(body.priority !== undefined && { priority: body.priority }),
          ...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
          ...(body.dueDate !== undefined && { dueDate: body.dueDate }),
        });

        logAudit(repository, request, paramsResult.data.householdId, 'create_caregiver_todo', todo.id, { title: body.title });
        return reply.status(201).send({
          status: 'success',
          data: todo,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/caregiver-todos/:todoId - Update caregiver todo
  fastify.patch(
    '/v1/households/:householdId/caregiver-todos/:todoId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Caregiver Todos'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            todoId: { type: 'string' },
          },
          required: ['householdId', 'todoId'],
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: ['string', 'null'], maxLength: 1000 },
            priority: { type: 'string', enum: ['low', 'normal', 'high'] },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
            assignedTo: { type: ['string', 'null'] },
            dueDate: { type: ['string', 'null'] },
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
      const paramsResult = caregiverTodoParamsSchema.safeParse(request.params);
      const bodyResult = updateCaregiverTodoBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageCaregiverTodos');
        const body = bodyResult.data;

        const updates: Record<string, unknown> = {};
        if (body.title !== undefined) updates.title = body.title;
        if (body.description !== undefined) updates.description = body.description;
        if (body.priority !== undefined) updates.priority = body.priority;
        if (body.status !== undefined) updates.status = body.status;
        if (body.assignedTo !== undefined) updates.assignedTo = body.assignedTo;
        if (body.dueDate !== undefined) updates.dueDate = body.dueDate;

        const todo = await useCases.updateCaregiverTodoUseCase.execute({
          todoId: paramsResult.data.todoId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          updates,
        });

        logAudit(repository, request, paramsResult.data.householdId, 'update_caregiver_todo', paramsResult.data.todoId, { title: todo.title });
        return reply.status(200).send({
          status: 'success',
          data: todo,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/caregiver-todos/:todoId - Delete caregiver todo
  fastify.delete(
    '/v1/households/:householdId/caregiver-todos/:todoId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Caregiver Todos'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            todoId: { type: 'string' },
          },
          required: ['householdId', 'todoId'],
        },
        response: {
          204: {
            type: 'null',
            description: 'Caregiver todo deleted successfully',
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = caregiverTodoParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'deleteCaregiverTodos');
        await useCases.deleteCaregiverTodoUseCase.execute({
          todoId: paramsResult.data.todoId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        logAudit(repository, request, paramsResult.data.householdId, 'delete_caregiver_todo', paramsResult.data.todoId);
        return reply.status(204).send();
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/caregiver-todos/:todoId/complete - Complete caregiver todo
  fastify.post(
    '/v1/households/:householdId/caregiver-todos/:todoId/complete',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Caregiver Todos'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            todoId: { type: 'string' },
          },
          required: ['householdId', 'todoId'],
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
      const paramsResult = caregiverTodoParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const todo = await useCases.completeCaregiverTodoUseCase.execute({
          todoId: paramsResult.data.todoId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        logAudit(repository, request, paramsResult.data.householdId, 'complete_caregiver_todo', paramsResult.data.todoId, { title: todo.title });
        return reply.status(200).send({
          status: 'success',
          data: todo,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/caregiver-todos/:todoId/nudge - Nudge caregiver todo
  fastify.post(
    '/v1/households/:householdId/caregiver-todos/:todoId/nudge',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Caregiver Todos'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            todoId: { type: 'string' },
          },
          required: ['householdId', 'todoId'],
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
      const paramsResult = caregiverTodoParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const todo = await useCases.nudgeCaregiverTodoUseCase.execute({
          todoId: paramsResult.data.todoId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        logAudit(repository, request, paramsResult.data.householdId, 'nudge_caregiver_todo', paramsResult.data.todoId, { title: todo.title });
        return reply.status(200).send({
          status: 'success',
          data: todo,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/caregiver-todos/:todoId/comments - Add comment to caregiver todo
  fastify.post(
    '/v1/households/:householdId/caregiver-todos/:todoId/comments',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Caregiver Todos'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            todoId: { type: 'string' },
          },
          required: ['householdId', 'todoId'],
        },
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 1000 },
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
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = caregiverTodoParamsSchema.safeParse(request.params);
      const bodyResult = addCommentBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const comment = await useCases.addCaregiverTodoCommentUseCase.execute({
          todoId: paramsResult.data.todoId,
          householdId: paramsResult.data.householdId,
          content: bodyResult.data.content,
          requester: getRequesterContext(request),
        });

        logAudit(repository, request, paramsResult.data.householdId, 'add_caregiver_todo_comment', paramsResult.data.todoId);
        return reply.status(201).send({
          status: 'success',
          data: comment,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
