import type { FastifyInstance } from 'fastify';
import type { ListHouseholdTasksUseCase } from '../../domain/usecases/tasks/ListHouseholdTasksUseCase.js';
import type { CreateTaskUseCase } from '../../domain/usecases/tasks/CreateTaskUseCase.js';
import type { UpdateTaskUseCase } from '../../domain/usecases/tasks/UpdateTaskUseCase.js';
import type { DeleteTaskUseCase } from '../../domain/usecases/tasks/DeleteTaskUseCase.js';
import type { CompleteTaskUseCase } from '../../domain/usecases/tasks/CompleteTaskUseCase.js';
import type { CreateTaskReminderUseCase } from '../../domain/usecases/tasks/CreateTaskReminderUseCase.js';
import type { UpdateTaskReminderUseCase } from '../../domain/usecases/tasks/UpdateTaskReminderUseCase.js';
import type { DeleteTaskReminderUseCase } from '../../domain/usecases/tasks/DeleteTaskReminderUseCase.js';
import { paramsSchema, errorResponseSchema } from './schemas.js';
import {
  createTaskBodySchema,
  updateTaskBodySchema,
  completeTaskBodySchema,
  taskParamsSchema,
  listTasksQuerySchema,
  taskReminderParamsSchema,
  createTaskReminderBodySchema,
  updateTaskReminderBodySchema,
} from './taskSchemas.js';
import { handleDomainError } from '../errorHandler.js';

export function registerTaskRoutes(
  fastify: FastifyInstance,
  useCases: {
    listHouseholdTasksUseCase: ListHouseholdTasksUseCase;
    createTaskUseCase: CreateTaskUseCase;
    updateTaskUseCase: UpdateTaskUseCase;
    deleteTaskUseCase: DeleteTaskUseCase;
    completeTaskUseCase: CompleteTaskUseCase;
    createTaskReminderUseCase: CreateTaskReminderUseCase;
    updateTaskReminderUseCase: UpdateTaskReminderUseCase;
    deleteTaskReminderUseCase: DeleteTaskReminderUseCase;
  },
): void {
  // GET /v1/households/:householdId/tasks - List household tasks
  fastify.get(
    '/v1/households/:householdId/tasks',
    {
      schema: {
        tags: ['Tasks'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'completed', 'cancelled'] },
            seniorId: { type: 'string' },
            category: { 
              type: 'string', 
              enum: ['hydration', 'meals', 'medication', 'hygiene', 'mobility', 'social', 'medical', 'household', 'other'] 
            },
            fromDate: { type: 'string' },
            toDate: { type: 'string' },
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
      const queryResult = listTasksQuerySchema.safeParse(request.query);

      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const filters = queryResult.data;
        const taskFilters: any = {};
        if (filters.status) taskFilters.status = filters.status;
        if (filters.seniorId) taskFilters.seniorId = filters.seniorId;
        if (filters.category) taskFilters.category = filters.category;
        if (filters.fromDate) taskFilters.fromDate = filters.fromDate;
        if (filters.toDate) taskFilters.toDate = filters.toDate;

        const tasks = await useCases.listHouseholdTasksUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          filters: taskFilters,
        });

        return reply.status(200).send({
          status: 'success',
          data: tasks,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/tasks - Create task
  fastify.post(
    '/v1/households/:householdId/tasks',
    {
      schema: {
        tags: ['Tasks'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          required: ['title', 'seniorId', 'category'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            seniorId: { type: 'string' },
            description: { type: 'string', maxLength: 1000 },
            category: { 
              type: 'string', 
              enum: ['hydration', 'meals', 'medication', 'hygiene', 'mobility', 'social', 'medical', 'household', 'other'] 
            },
            priority: { type: 'string', enum: ['low', 'normal', 'high'] },
            dueDate: { type: 'string' },
            dueTime: { type: 'string' },
            caregiverId: { type: 'string' },
            recurrence: { type: 'object' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object' },
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
      const bodyResult = createTaskBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const body = bodyResult.data;
        const inputData: any = {
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          title: body.title,
          seniorId: body.seniorId,
          category: body.category,
        };

        if (body.description !== undefined) inputData.description = body.description;
        if (body.priority !== undefined) inputData.priority = body.priority;
        if (body.dueDate !== undefined) inputData.dueDate = body.dueDate;
        if (body.dueTime !== undefined) inputData.dueTime = body.dueTime;
        if (body.caregiverId !== undefined) inputData.caregiverId = body.caregiverId;
        if (body.recurrence !== undefined) inputData.recurrence = body.recurrence;

        const task = await useCases.createTaskUseCase.execute(inputData);

        return reply.status(201).send({
          status: 'success',
          data: task,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/tasks/:taskId - Update task
  fastify.patch(
    '/v1/households/:householdId/tasks/:taskId',
    {
      schema: {
        tags: ['Tasks'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            taskId: { type: 'string' },
          },
          required: ['householdId', 'taskId'],
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: ['string', 'null'], maxLength: 1000 },
            category: { 
              type: 'string', 
              enum: ['hydration', 'meals', 'medication', 'hygiene', 'mobility', 'social', 'medical', 'household', 'other'] 
            },
            priority: { type: 'string', enum: ['low', 'normal', 'high'] },
            status: { type: 'string', enum: ['pending', 'completed', 'cancelled'] },
            dueDate: { type: ['string', 'null'] },
            dueTime: { type: ['string', 'null'] },
            recurrence: { type: ['object', 'null'] },
            caregiverId: { type: ['string', 'null'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object' },
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
      const paramsResult = taskParamsSchema.safeParse(request.params);
      const bodyResult = updateTaskBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const updateData: any = {};
        const body = bodyResult.data;

        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.category !== undefined) updateData.category = body.category;
        if (body.priority !== undefined) updateData.priority = body.priority;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.dueDate !== undefined) updateData.dueDate = body.dueDate;
        if (body.dueTime !== undefined) updateData.dueTime = body.dueTime;
        if (body.recurrence !== undefined) updateData.recurrence = body.recurrence;
        if (body.caregiverId !== undefined) updateData.caregiverId = body.caregiverId;

        const task = await useCases.updateTaskUseCase.execute({
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          updates: updateData,
        });

        return reply.status(200).send({
          status: 'success',
          data: task,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/tasks/:taskId/complete - Complete task
  fastify.post(
    '/v1/households/:householdId/tasks/:taskId/complete',
    {
      schema: {
        tags: ['Tasks'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            taskId: { type: 'string' },
          },
          required: ['householdId', 'taskId'],
        },
        body: {
          type: 'object',
          properties: {
            completedAt: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object' },
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
      const paramsResult = taskParamsSchema.safeParse(request.params);
      const bodyResult = completeTaskBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const body = bodyResult.data;
        const inputData: any = {
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        };
        
        if (body.completedAt) inputData.completedAt = body.completedAt;

        const task = await useCases.completeTaskUseCase.execute(inputData);

        return reply.status(200).send({
          status: 'success',
          data: task,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/tasks/:taskId - Delete task
  fastify.delete(
    '/v1/households/:householdId/tasks/:taskId',
    {
      schema: {
        tags: ['Tasks'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            taskId: { type: 'string' },
          },
          required: ['householdId', 'taskId'],
        },
        response: {
          204: {
            type: 'null',
            description: 'Task deleted successfully',
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = taskParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await useCases.deleteTaskUseCase.execute({
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        });

        return reply.status(204).send();
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/tasks/:taskId/reminders - Create task reminder
  fastify.post(
    '/v1/households/:householdId/tasks/:taskId/reminders',
    {
      schema: {
        tags: ['Task Reminders'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            taskId: { type: 'string' },
          },
          required: ['householdId', 'taskId'],
        },
        body: {
          type: 'object',
          required: ['time', 'daysOfWeek'],
          properties: {
            time: { type: 'string' },
            daysOfWeek: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, minItems: 1 },
            enabled: { type: 'boolean' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object' },
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
      const paramsResult = taskParamsSchema.safeParse(request.params);
      const bodyResult = createTaskReminderBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const body = bodyResult.data;
        const inputData: any = {
          householdId: paramsResult.data.householdId,
          taskId: paramsResult.data.taskId,
          requester: request.requester,
          time: body.time,
          daysOfWeek: body.daysOfWeek,
          enabled: body.enabled ?? true,
        };

        const reminder = await useCases.createTaskReminderUseCase.execute(inputData);

        return reply.status(201).send({
          status: 'success',
          data: reminder,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/tasks/:taskId/reminders/:reminderId - Update task reminder
  fastify.patch(
    '/v1/households/:householdId/tasks/:taskId/reminders/:reminderId',
    {
      schema: {
        tags: ['Task Reminders'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            taskId: { type: 'string' },
            reminderId: { type: 'string' },
          },
          required: ['householdId', 'taskId', 'reminderId'],
        },
        body: {
          type: 'object',
          properties: {
            time: { type: 'string' },
            daysOfWeek: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, minItems: 1 },
            enabled: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object' },
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
      const paramsResult = taskReminderParamsSchema.safeParse(request.params);
      const bodyResult = updateTaskReminderBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const updateData: any = {};
        const body = bodyResult.data;

        if (body.time !== undefined) updateData.time = body.time;
        if (body.daysOfWeek !== undefined) updateData.daysOfWeek = body.daysOfWeek;
        if (body.enabled !== undefined) updateData.enabled = body.enabled;

        const reminder = await useCases.updateTaskReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          updates: updateData,
        });

        return reply.status(200).send({
          status: 'success',
          data: reminder,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/tasks/:taskId/reminders/:reminderId - Delete task reminder
  fastify.delete(
    '/v1/households/:householdId/tasks/:taskId/reminders/:reminderId',
    {
      schema: {
        tags: ['Task Reminders'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            taskId: { type: 'string' },
            reminderId: { type: 'string' },
          },
          required: ['householdId', 'taskId', 'reminderId'],
        },
        response: {
          204: {
            type: 'null',
            description: 'Task reminder deleted successfully',
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = taskReminderParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await useCases.deleteTaskReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        });

        return reply.status(204).send();
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
