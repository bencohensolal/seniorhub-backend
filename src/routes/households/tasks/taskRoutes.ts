import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { CompleteTaskInput, CreateTaskInput, TaskCategory, TaskRecurrence, TaskStatus, UpdateTaskInput } from '../../../domain/entities/Task.js';
import type { CreateTaskReminderInput, UpdateTaskReminderInput } from '../../../domain/entities/TaskReminder.js';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { ListHouseholdTasksUseCase } from '../../../domain/usecases/tasks/ListHouseholdTasksUseCase.js';
import type { CreateTaskUseCase } from '../../../domain/usecases/tasks/CreateTaskUseCase.js';
import type { UpdateTaskUseCase } from '../../../domain/usecases/tasks/UpdateTaskUseCase.js';
import type { DeleteTaskUseCase } from '../../../domain/usecases/tasks/DeleteTaskUseCase.js';
import type { CompleteTaskUseCase } from '../../../domain/usecases/tasks/CompleteTaskUseCase.js';
import type { ConfirmTaskUseCase } from '../../../domain/usecases/tasks/ConfirmTaskUseCase.js';
import type { CreateTaskReminderUseCase } from '../../../domain/usecases/tasks/CreateTaskReminderUseCase.js';
import type { UpdateTaskReminderUseCase } from '../../../domain/usecases/tasks/UpdateTaskReminderUseCase.js';
import type { DeleteTaskReminderUseCase } from '../../../domain/usecases/tasks/DeleteTaskReminderUseCase.js';
import { paramsSchema, errorResponseSchema } from '../householdSchemas.js';
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
import { logAudit } from '../auditHelper.js';
import { handleDomainError } from '../../errorHandler.js';
import { ensureHouseholdPermission, getRequesterContext, verifyTabletHouseholdAccess } from '../utils.js';
import { requireWritePermission } from '../../../plugins/authContext.js';
import {
  anonymizeTasksByPrivacy,
  assertRequesterCanShareActivityHistory,
  buildHouseholdPrivacyContext,
} from '../../../domain/services/privacyFilter.js';

export function registerTaskRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  useCases: {
    listHouseholdTasksUseCase: ListHouseholdTasksUseCase;
    createTaskUseCase: CreateTaskUseCase;
    updateTaskUseCase: UpdateTaskUseCase;
    deleteTaskUseCase: DeleteTaskUseCase;
    completeTaskUseCase: CompleteTaskUseCase;
    confirmTaskUseCase: ConfirmTaskUseCase;
    createTaskReminderUseCase: CreateTaskReminderUseCase;
    updateTaskReminderUseCase: UpdateTaskReminderUseCase;
    deleteTaskReminderUseCase: DeleteTaskReminderUseCase;
  },
): void {
  type CreateTaskRouteInput = Parameters<CreateTaskUseCase['execute']>[0];
  type TaskRecurrenceInput = z.infer<typeof createTaskBodySchema>['recurrence'];

  const normalizeTaskRecurrence = (recurrence: TaskRecurrenceInput): TaskRecurrence | undefined => {
    if (!recurrence) {
      return undefined;
    }

    return {
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      ...(recurrence.daysOfWeek !== undefined && { daysOfWeek: recurrence.daysOfWeek }),
      ...(recurrence.dayOfMonth !== undefined && { dayOfMonth: recurrence.dayOfMonth }),
      ...(recurrence.endDate !== undefined && { endDate: recurrence.endDate }),
      ...(recurrence.occurrences !== undefined && { occurrences: recurrence.occurrences }),
    };
  };

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
              enum: ['hydration', 'meals', 'hygiene', 'mobility', 'social', 'household', 'other']
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
        const taskFilters: {
          status?: TaskStatus;
          seniorId?: string;
          category?: TaskCategory;
          fromDate?: string;
          toDate?: string;
        } = {};
        if (filters.status) taskFilters.status = filters.status;
        if (filters.seniorId) taskFilters.seniorId = filters.seniorId;
        if (filters.category) taskFilters.category = filters.category;
        if (filters.fromDate) taskFilters.fromDate = filters.fromDate;
        if (filters.toDate) taskFilters.toDate = filters.toDate;

        const tasks = await useCases.listHouseholdTasksUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          filters: taskFilters,
        });
        const privacyContext = await buildHouseholdPrivacyContext(repository, paramsResult.data.householdId);
        const filteredTasks = anonymizeTasksByPrivacy(
          tasks,
          privacyContext,
          request.requester?.userId,
        );

        return reply.status(200).send({
          status: 'success',
          data: filteredTasks,
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
          required: ['title', 'seniorIds', 'category'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            seniorIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
            description: { type: 'string', maxLength: 1000 },
            category: {
              type: 'string',
              enum: ['hydration', 'nutrition', 'exercise', 'social', 'household', 'wellbeing', 'other']
            },
            priority: { type: 'string', enum: ['low', 'normal', 'high'] },
            dueDate: { type: 'string' },
            dueTime: { type: 'string' },
            duration: { type: 'integer', minimum: 1, maximum: 1440 },
            caregiverId: { type: 'string' },
            recurrence: { type: 'object' },
            requiresConfirmation: { type: 'boolean' },
            confirmationDelayMinutes: { type: 'integer', minimum: 5, maximum: 480 },
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
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageTasks');
        const body = bodyResult.data;
        const inputData: CreateTaskRouteInput = {
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          title: body.title,
          seniorIds: body.seniorIds,
          category: body.category,
        };

        if (body.description !== undefined) inputData.description = body.description;
        if (body.priority !== undefined) inputData.priority = body.priority;
        if (body.dueDate !== undefined) inputData.dueDate = body.dueDate;
        if (body.dueTime !== undefined) inputData.dueTime = body.dueTime;
        if (body.duration !== undefined) inputData.duration = body.duration;
        if (body.caregiverId !== undefined) inputData.caregiverId = body.caregiverId;
        if (body.recurrence !== undefined) {
          const recurrence = normalizeTaskRecurrence(body.recurrence);
          if (recurrence !== undefined) {
            inputData.recurrence = recurrence;
          }
        }
        if (body.requiresConfirmation !== undefined) inputData.requiresConfirmation = body.requiresConfirmation;
        if (body.confirmationDelayMinutes !== undefined) inputData.confirmationDelayMinutes = body.confirmationDelayMinutes;

        const task = await useCases.createTaskUseCase.execute(inputData);

        logAudit(repository, request, paramsResult.data.householdId, 'create_task', task.id, { title: body.title });
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
            seniorIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
            title: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: ['string', 'null'], maxLength: 1000 },
            category: {
              type: 'string',
              enum: ['hydration', 'nutrition', 'exercise', 'social', 'household', 'wellbeing', 'other']
            },
            priority: { type: 'string', enum: ['low', 'normal', 'high'] },
            status: { type: 'string', enum: ['pending', 'completed', 'cancelled'] },
            dueDate: { type: ['string', 'null'] },
            dueTime: { type: ['string', 'null'] },
            duration: { type: ['integer', 'null'], minimum: 1, maximum: 1440 },
            recurrence: { type: ['object', 'null'] },
            caregiverId: { type: ['string', 'null'] },
            requiresConfirmation: { type: 'boolean' },
            confirmationDelayMinutes: { type: ['integer', 'null'], minimum: 5, maximum: 480 },
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
        if (bodyResult.data.status === 'completed') {
          await assertRequesterCanShareActivityHistory(repository, request.requester!.userId);
        }
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageTasks');
        const updateData: UpdateTaskInput = {};
        const body = bodyResult.data;

        if (body.seniorIds !== undefined) updateData.seniorIds = body.seniorIds;
        if (body.title !== undefined) updateData.title = body.title;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.category !== undefined) updateData.category = body.category;
        if (body.priority !== undefined) updateData.priority = body.priority;
        if (body.status !== undefined) updateData.status = body.status;
        if (body.dueDate !== undefined) updateData.dueDate = body.dueDate;
        if (body.dueTime !== undefined) updateData.dueTime = body.dueTime;
        if (body.duration !== undefined) updateData.duration = body.duration;
        if (body.recurrence !== undefined) {
          const recurrence = body.recurrence ? normalizeTaskRecurrence(body.recurrence) : null;
          if (recurrence !== undefined) {
            updateData.recurrence = recurrence;
          }
        }
        if (body.caregiverId !== undefined) updateData.caregiverId = body.caregiverId;
        if (body.requiresConfirmation !== undefined) updateData.requiresConfirmation = body.requiresConfirmation;
        if (body.confirmationDelayMinutes !== undefined) updateData.confirmationDelayMinutes = body.confirmationDelayMinutes;

        const task = await useCases.updateTaskUseCase.execute({
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          updates: updateData,
        });

        logAudit(repository, request, paramsResult.data.householdId, 'update_task', paramsResult.data.taskId);
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
        await assertRequesterCanShareActivityHistory(repository, request.requester!.userId);
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageTasks');
        const body = bodyResult.data;
        const inputData: CompleteTaskInput & {
          taskId: string;
          householdId: string;
          requester: ReturnType<typeof getRequesterContext>;
        } = {
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        };

        if (body.completedAt) inputData.completedAt = body.completedAt;

        const task = await useCases.completeTaskUseCase.execute(inputData);

        logAudit(repository, request, paramsResult.data.householdId, 'complete_task', paramsResult.data.taskId);
        return reply.status(200).send({
          status: 'success',
          data: task,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/tasks/:taskId/confirm - Confirm task (senior)
  fastify.post(
    '/v1/households/:householdId/tasks/:taskId/confirm',
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

      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const task = await useCases.confirmTaskUseCase.execute({
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        logAudit(repository, request, paramsResult.data.householdId, 'confirm_task', paramsResult.data.taskId);
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
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'deleteTasks');
        await useCases.deleteTaskUseCase.execute({
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        logAudit(repository, request, paramsResult.data.householdId, 'delete_task', paramsResult.data.taskId);
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
          properties: {
            time: { type: 'string' },
            daysOfWeek: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, minItems: 1 },
            triggerBefore: { type: 'integer', minimum: 1, maximum: 10080 },
            customMessage: { type: 'string', maxLength: 500 },
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
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageTasks');
        const body = bodyResult.data;
        const inputData: CreateTaskReminderInput & {
          householdId: string;
          requester: ReturnType<typeof getRequesterContext>;
        } = {
          householdId: paramsResult.data.householdId,
          taskId: paramsResult.data.taskId,
          requester: getRequesterContext(request),
        };

        if (body.time !== undefined) inputData.time = body.time;
        if (body.daysOfWeek !== undefined) inputData.daysOfWeek = body.daysOfWeek;
        if (body.triggerBefore !== undefined) inputData.triggerBefore = body.triggerBefore;
        if (body.customMessage !== undefined) inputData.customMessage = body.customMessage;
        inputData.enabled = body.enabled ?? true;

        const reminder = await useCases.createTaskReminderUseCase.execute(inputData);

        logAudit(repository, request, paramsResult.data.householdId, 'create_task_reminder', reminder.id);
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
            time: { type: ['string', 'null'] },
            daysOfWeek: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 }, minItems: 1 },
            triggerBefore: { type: ['integer', 'null'], minimum: 1, maximum: 10080 },
            customMessage: { type: ['string', 'null'], maxLength: 500 },
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
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageTasks');
        const updateData: UpdateTaskReminderInput = {};
        const body = bodyResult.data;

        if (body.time !== undefined) updateData.time = body.time;
        if (body.daysOfWeek !== undefined) updateData.daysOfWeek = body.daysOfWeek;
        if (body.triggerBefore !== undefined) updateData.triggerBefore = body.triggerBefore;
        if (body.customMessage !== undefined) updateData.customMessage = body.customMessage;
        if (body.enabled !== undefined) updateData.enabled = body.enabled;

        const reminder = await useCases.updateTaskReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          updates: updateData,
        });

        logAudit(repository, request, paramsResult.data.householdId, 'update_task_reminder', paramsResult.data.reminderId);
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
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageTasks');
        await useCases.deleteTaskReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          taskId: paramsResult.data.taskId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        logAudit(repository, request, paramsResult.data.householdId, 'delete_task_reminder', paramsResult.data.reminderId);
        return reply.status(204).send();
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
