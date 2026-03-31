import type { FastifyInstance } from 'fastify';
import type { OccurrenceOverrides } from '../../../domain/entities/AppointmentOccurrence.js';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { ListAppointmentOccurrencesUseCase } from '../../../domain/usecases/appointments/ListAppointmentOccurrencesUseCase.js';
import type { ModifyOccurrenceUseCase } from '../../../domain/usecases/appointments/ModifyOccurrenceUseCase.js';
import type { CancelOccurrenceUseCase } from '../../../domain/usecases/appointments/CancelOccurrenceUseCase.js';
import type { BatchModifyOccurrencesUseCase } from '../../../domain/usecases/appointments/BatchModifyOccurrencesUseCase.js';
import type { BatchCancelOccurrencesUseCase } from '../../../domain/usecases/appointments/BatchCancelOccurrencesUseCase.js';
import type { RestoreOccurrenceUseCase } from '../../../domain/usecases/appointments/RestoreOccurrenceUseCase.js';
import { errorResponseSchema } from '../householdSchemas.js';
import {
  appointmentParamsSchema,
  occurrenceParamsSchema,
  occurrenceQuerySchema,
  modifyOccurrenceBodySchema,
  batchModifyOccurrencesBodySchema,
  batchCancelOccurrencesBodySchema,
} from './appointmentSchemas.js';
import { handleDomainError } from '../../errorHandler.js';
import { requireWritePermission } from '../../../plugins/authContext.js';
import { ensureHouseholdPermission, verifyTabletHouseholdAccess, getRequesterContext } from '../utils.js';
import { NotFoundError } from '../../../domain/errors/index.js';

export function registerOccurrenceRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  useCases: {
    listAppointmentOccurrencesUseCase: ListAppointmentOccurrencesUseCase;
    modifyOccurrenceUseCase: ModifyOccurrenceUseCase;
    cancelOccurrenceUseCase: CancelOccurrenceUseCase;
    batchModifyOccurrencesUseCase: BatchModifyOccurrencesUseCase;
    batchCancelOccurrencesUseCase: BatchCancelOccurrencesUseCase;
    restoreOccurrenceUseCase: RestoreOccurrenceUseCase;
  },
): void {
  // POST /v1/households/:householdId/appointments/:appointmentId/occurrences/batch-modify - Batch modify occurrences (WRITE - tablets blocked)
  fastify.post(
    '/v1/households/:householdId/appointments/:appointmentId/occurrences/batch-modify',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointment Occurrences'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            appointmentId: { type: 'string' },
          },
          required: ['householdId', 'appointmentId'],
        },
        body: {
          type: 'object',
          required: ['modifications'],
          properties: {
            modifications: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['occurrenceDate', 'overrides'],
                properties: {
                  occurrenceDate: { type: 'string' },
                  overrides: { type: 'object' },
                },
              },
            },
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
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = appointmentParamsSchema.safeParse(request.params);
      const bodyResult = batchModifyOccurrencesBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageAppointments');

        const requester = getRequesterContext(request);
        const results = await useCases.batchModifyOccurrencesUseCase.execute({
          userId: requester.userId,
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          modifications: bodyResult.data.modifications as Array<{ occurrenceDate: string; overrides: OccurrenceOverrides }>,
        });

        return reply.status(200).send({ status: 'success', data: results });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/appointments/:appointmentId/occurrences/batch-cancel - Batch cancel occurrences (WRITE - tablets blocked)
  fastify.post(
    '/v1/households/:householdId/appointments/:appointmentId/occurrences/batch-cancel',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointment Occurrences'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            appointmentId: { type: 'string' },
          },
          required: ['householdId', 'appointmentId'],
        },
        body: {
          type: 'object',
          required: ['dates'],
          properties: {
            dates: {
              type: 'array',
              minItems: 1,
              items: { type: 'string' },
            },
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
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = appointmentParamsSchema.safeParse(request.params);
      const bodyResult = batchCancelOccurrencesBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageAppointments');

        const requester = getRequesterContext(request);
        const results = await useCases.batchCancelOccurrencesUseCase.execute({
          userId: requester.userId,
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          dates: bodyResult.data.dates,
        });

        return reply.status(200).send({ status: 'success', data: results });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate/restore - Restore cancelled occurrence (WRITE - tablets blocked)
  fastify.post(
    '/v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate/restore',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointment Occurrences'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            appointmentId: { type: 'string' },
            occurrenceDate: { type: 'string' },
          },
          required: ['householdId', 'appointmentId', 'occurrenceDate'],
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
      const paramsResult = occurrenceParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageAppointments');

        const requester = getRequesterContext(request);
        const occurrence = await useCases.restoreOccurrenceUseCase.execute({
          userId: requester.userId,
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          occurrenceDate: paramsResult.data.occurrenceDate,
        });

        return reply.status(200).send({ status: 'success', data: occurrence });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // GET /v1/households/:householdId/appointments/:appointmentId/occurrences - List appointment occurrences (READ - tablets allowed)
  fastify.get(
    '/v1/households/:householdId/appointments/:appointmentId/occurrences',
    {
      schema: {
        tags: ['Appointment Occurrences'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            appointmentId: { type: 'string' },
          },
          required: ['householdId', 'appointmentId'],
        },
        querystring: {
          type: 'object',
          required: ['from', 'to'],
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
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
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = appointmentParamsSchema.safeParse(request.params);
      const queryResult = occurrenceQuerySchema.safeParse(request.query);

      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        verifyTabletHouseholdAccess(request, reply, paramsResult.data.householdId);

        const appointment = await repository.getAppointmentById(
          paramsResult.data.appointmentId,
          paramsResult.data.householdId,
        );
        if (!appointment) {
          throw new NotFoundError('Appointment not found.');
        }

        const requester = getRequesterContext(request);
        const occurrences = await useCases.listAppointmentOccurrencesUseCase.execute({
          userId: requester.userId,
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          fromDate: queryResult.data.from,
          toDate: queryResult.data.to,
        });

        return reply.status(200).send({ status: 'success', data: occurrences });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate - Modify occurrence (WRITE - tablets blocked)
  fastify.patch(
    '/v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointment Occurrences'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            appointmentId: { type: 'string' },
            occurrenceDate: { type: 'string' },
          },
          required: ['householdId', 'appointmentId', 'occurrenceDate'],
        },
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            time: { type: 'string' },
            duration: { type: 'number' },
            locationName: { type: 'string', maxLength: 255 },
            address: { type: 'string', maxLength: 500 },
            phoneNumber: { type: 'string', maxLength: 50 },
            contactName: { type: 'string', maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
            itemsToTake: { type: 'string', maxLength: 500 },
            transportArrangement: { type: 'string', maxLength: 500 },
            notes: { type: 'string', maxLength: 1000 },
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
      const paramsResult = occurrenceParamsSchema.safeParse(request.params);
      const bodyResult = modifyOccurrenceBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageAppointments');

        const requester = getRequesterContext(request);
        const occurrence = await useCases.modifyOccurrenceUseCase.execute({
          userId: requester.userId,
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          occurrenceDate: paramsResult.data.occurrenceDate,
          overrides: (bodyResult.data.overrides || {}) as OccurrenceOverrides,
        });

        return reply.status(200).send({ status: 'success', data: occurrence });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate - Cancel occurrence (WRITE - tablets blocked)
  fastify.delete(
    '/v1/households/:householdId/appointments/:appointmentId/occurrences/:occurrenceDate',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointment Occurrences'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            appointmentId: { type: 'string' },
            occurrenceDate: { type: 'string' },
          },
          required: ['householdId', 'appointmentId', 'occurrenceDate'],
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
      const paramsResult = occurrenceParamsSchema.safeParse(request.params);

      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageAppointments');

        const requester = getRequesterContext(request);
        const occurrence = await useCases.cancelOccurrenceUseCase.execute({
          userId: requester.userId,
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          occurrenceDate: paramsResult.data.occurrenceDate,
        });

        return reply.status(200).send({ status: 'success', data: occurrence });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
