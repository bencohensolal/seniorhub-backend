import type { FastifyInstance } from 'fastify';
import type { ListMedicationRemindersUseCase } from '../../domain/usecases/ListMedicationRemindersUseCase.js';
import type { CreateReminderUseCase } from '../../domain/usecases/CreateReminderUseCase.js';
import type { UpdateReminderUseCase } from '../../domain/usecases/UpdateReminderUseCase.js';
import type { DeleteReminderUseCase } from '../../domain/usecases/DeleteReminderUseCase.js';
import { errorResponseSchema } from './schemas.js';
import {
  medicationParamsSchema,
  reminderParamsSchema,
  createReminderBodySchema,
  updateReminderBodySchema,
} from './medicationSchemas.js';

export function registerReminderRoutes(
  fastify: FastifyInstance,
  useCases: {
    listMedicationRemindersUseCase: ListMedicationRemindersUseCase;
    createReminderUseCase: CreateReminderUseCase;
    updateReminderUseCase: UpdateReminderUseCase;
    deleteReminderUseCase: DeleteReminderUseCase;
  },
): void {
  // GET /v1/households/:householdId/medications/:medicationId/reminders - List medication reminders
  fastify.get(
    '/v1/households/:householdId/medications/:medicationId/reminders',
    {
      schema: {
        tags: ['Medication Reminders'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            medicationId: { type: 'string' },
          },
          required: ['householdId', 'medicationId'],
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
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = medicationParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const reminders = await useCases.listMedicationRemindersUseCase.execute({
          medicationId: paramsResult.data.medicationId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        });

        return reply.status(200).send({
          status: 'success',
          data: reminders,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        
        if (message.includes('Access denied')) {
          return reply.status(403).send({
            status: 'error',
            message,
          });
        }
        
        if (message.includes('not found')) {
          return reply.status(404).send({
            status: 'error',
            message,
          });
        }

        return reply.status(500).send({
          status: 'error',
          message,
        });
      }
    },
  );

  // POST /v1/households/:householdId/medications/:medicationId/reminders - Create reminder
  fastify.post(
    '/v1/households/:householdId/medications/:medicationId/reminders',
    {
      schema: {
        tags: ['Medication Reminders'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            medicationId: { type: 'string' },
          },
          required: ['householdId', 'medicationId'],
        },
        body: {
          type: 'object',
          required: ['time', 'daysOfWeek'],
          properties: {
            time: { type: 'string', pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' },
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
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = medicationParamsSchema.safeParse(request.params);
      const bodyResult = createReminderBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const reminder = await useCases.createReminderUseCase.execute({
          medicationId: paramsResult.data.medicationId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          time: bodyResult.data.time,
          daysOfWeek: bodyResult.data.daysOfWeek,
          enabled: bodyResult.data.enabled,
        });

        return reply.status(201).send({
          status: 'success',
          data: reminder,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        
        if (message.includes('Only caregivers')) {
          return reply.status(403).send({
            status: 'error',
            message,
          });
        }
        
        if (message.includes('not found')) {
          return reply.status(404).send({
            status: 'error',
            message,
          });
        }

        return reply.status(500).send({
          status: 'error',
          message,
        });
      }
    },
  );

  // PUT /v1/households/:householdId/medications/:medicationId/reminders/:reminderId - Update reminder
  fastify.put(
    '/v1/households/:householdId/medications/:medicationId/reminders/:reminderId',
    {
      schema: {
        tags: ['Medication Reminders'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            medicationId: { type: 'string' },
            reminderId: { type: 'string' },
          },
          required: ['householdId', 'medicationId', 'reminderId'],
        },
        body: {
          type: 'object',
          properties: {
            time: { type: 'string', pattern: '^([0-1][0-9]|2[0-3]):[0-5][0-9]$' },
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
      const paramsResult = reminderParamsSchema.safeParse(request.params);
      const bodyResult = updateReminderBodySchema.safeParse(request.body);

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

        const reminder = await useCases.updateReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          medicationId: paramsResult.data.medicationId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          data: updateData,
        });

        return reply.status(200).send({
          status: 'success',
          data: reminder,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        
        if (message.includes('Only caregivers')) {
          return reply.status(403).send({
            status: 'error',
            message,
          });
        }
        
        if (message.includes('not found')) {
          return reply.status(404).send({
            status: 'error',
            message,
          });
        }

        return reply.status(500).send({
          status: 'error',
          message,
        });
      }
    },
  );

  // DELETE /v1/households/:householdId/medications/:medicationId/reminders/:reminderId - Delete reminder
  fastify.delete(
    '/v1/households/:householdId/medications/:medicationId/reminders/:reminderId',
    {
      schema: {
        tags: ['Medication Reminders'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            medicationId: { type: 'string' },
            reminderId: { type: 'string' },
          },
          required: ['householdId', 'medicationId', 'reminderId'],
        },
        response: {
          204: {
            type: 'null',
            description: 'Reminder deleted successfully',
          },
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = reminderParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await useCases.deleteReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          medicationId: paramsResult.data.medicationId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        });

        return reply.status(204).send();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        
        if (message.includes('Only caregivers')) {
          return reply.status(403).send({
            status: 'error',
            message,
          });
        }
        
        if (message.includes('not found')) {
          return reply.status(404).send({
            status: 'error',
            message,
          });
        }

        return reply.status(500).send({
          status: 'error',
          message,
        });
      }
    },
  );
}
