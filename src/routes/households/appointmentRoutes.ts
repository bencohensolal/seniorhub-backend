import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { CreateAppointmentInput, UpdateAppointmentInput } from '../../domain/entities/Appointment.js';
import type { CreateAppointmentReminderInput, UpdateAppointmentReminderInput } from '../../domain/entities/AppointmentReminder.js';
import type { OccurrenceOverrides } from '../../domain/entities/AppointmentOccurrence.js';
import type { ListHouseholdAppointmentsUseCase } from '../../domain/usecases/appointments/ListHouseholdAppointmentsUseCase.js';
import type { CreateAppointmentUseCase } from '../../domain/usecases/appointments/CreateAppointmentUseCase.js';
import type { UpdateAppointmentUseCase } from '../../domain/usecases/appointments/UpdateAppointmentUseCase.js';
import type { DeleteAppointmentUseCase } from '../../domain/usecases/appointments/DeleteAppointmentUseCase.js';
import type { CreateAppointmentReminderUseCase } from '../../domain/usecases/appointments/CreateAppointmentReminderUseCase.js';
import type { UpdateAppointmentReminderUseCase } from '../../domain/usecases/appointments/UpdateAppointmentReminderUseCase.js';
import type { DeleteAppointmentReminderUseCase } from '../../domain/usecases/appointments/DeleteAppointmentReminderUseCase.js';
import type { ListAppointmentOccurrencesUseCase } from '../../domain/usecases/appointments/ListAppointmentOccurrencesUseCase.js';
import type { ModifyOccurrenceUseCase } from '../../domain/usecases/appointments/ModifyOccurrenceUseCase.js';
import type { CancelOccurrenceUseCase } from '../../domain/usecases/appointments/CancelOccurrenceUseCase.js';
import { paramsSchema, errorResponseSchema } from './schemas.js';
import {
  createAppointmentBodySchema,
  updateAppointmentBodySchema,
  appointmentParamsSchema,
  appointmentReminderParamsSchema,
  createAppointmentReminderBodySchema,
  updateAppointmentReminderBodySchema,
  occurrenceParamsSchema,
  occurrenceQuerySchema,
  modifyOccurrenceBodySchema,
} from './appointmentSchemas.js';
import { handleDomainError } from '../errorHandler.js';
import { requireWritePermission } from '../../plugins/authContext.js';
import { verifyTabletHouseholdAccess, getRequesterContext } from './utils.js';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import {
  assertRequesterCanShareHealthData,
  buildHouseholdPrivacyContext,
  filterAppointmentsByPrivacy,
} from '../../domain/services/privacyFilter.js';
import { NotFoundError } from '../../domain/errors/index.js';

export function registerAppointmentRoutes(
  fastify: FastifyInstance,
  useCases: {
    listHouseholdAppointmentsUseCase: ListHouseholdAppointmentsUseCase;
    createAppointmentUseCase: CreateAppointmentUseCase;
    updateAppointmentUseCase: UpdateAppointmentUseCase;
    deleteAppointmentUseCase: DeleteAppointmentUseCase;
    createAppointmentReminderUseCase: CreateAppointmentReminderUseCase;
    updateAppointmentReminderUseCase: UpdateAppointmentReminderUseCase;
    deleteAppointmentReminderUseCase: DeleteAppointmentReminderUseCase;
    listAppointmentOccurrencesUseCase: ListAppointmentOccurrencesUseCase;
    modifyOccurrenceUseCase: ModifyOccurrenceUseCase;
    cancelOccurrenceUseCase: CancelOccurrenceUseCase;
  },
  repository: HouseholdRepository,
): void {
  type CreateAppointmentRouteInput = Parameters<CreateAppointmentUseCase['execute']>[0];
  type AppointmentRecurrenceInput = z.infer<typeof createAppointmentBodySchema>['recurrence'];

  const normalizeRecurrence = (recurrence: AppointmentRecurrenceInput): CreateAppointmentInput['recurrence'] => {
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

  // GET /v1/households/:householdId/appointments - List household appointments (READ - tablets allowed)
  fastify.get(
    '/v1/households/:householdId/appointments',
    {
      schema: {
        tags: ['Appointments'],
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
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        // Verify tablet can only access its own household
        verifyTabletHouseholdAccess(request, reply, paramsResult.data.householdId);

        const appointments = await useCases.listHouseholdAppointmentsUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });
        const privacyContext = await buildHouseholdPrivacyContext(repository, paramsResult.data.householdId);
        const filteredAppointments = filterAppointmentsByPrivacy(
          appointments,
          privacyContext,
          request.requester?.userId,
        );

        return reply.status(200).send({
          status: 'success',
          data: filteredAppointments,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/appointments - Create appointment (WRITE - tablets blocked)
  fastify.post(
    '/v1/households/:householdId/appointments',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointments'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          required: ['title', 'type', 'date', 'time', 'seniorIds'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            type: {
              type: 'string',
              enum: ['doctor', 'specialist', 'dentist', 'lab', 'imaging', 'therapy', 'pharmacy', 'hospital', 'other']
            },
            date: { type: 'string' },
            time: { type: 'string' },
            duration: { type: 'number' },
            seniorIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
            caregiverId: { type: 'string' },
            address: { type: 'string', maxLength: 500 },
            locationName: { type: 'string', maxLength: 255 },
            phoneNumber: { type: 'string', maxLength: 50 },
            description: { type: 'string', maxLength: 1000 },
            professionalName: { type: 'string', maxLength: 255 },
            preparation: { type: 'string', maxLength: 1000 },
            documentsToTake: { type: 'string', maxLength: 500 },
            transportArrangement: { type: 'string', maxLength: 500 },
            recurrence: { type: 'object' },
            status: {
              type: 'string',
              enum: ['scheduled', 'confirmed', 'cancelled', 'completed', 'missed']
            },
            notes: { type: 'string', maxLength: 1000 },
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
      const bodyResult = createAppointmentBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);

        const body = bodyResult.data;
        const inputData: CreateAppointmentRouteInput = {
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          title: body.title,
          type: body.type,
          date: body.date,
          time: body.time,
          seniorIds: body.seniorIds,
        };

        if (body.duration !== undefined) inputData.duration = body.duration;
        if (body.caregiverId !== undefined) inputData.caregiverId = body.caregiverId;
        if (body.address !== undefined) inputData.address = body.address;
        if (body.locationName !== undefined) inputData.locationName = body.locationName;
        if (body.phoneNumber !== undefined) inputData.phoneNumber = body.phoneNumber;
        if (body.description !== undefined) inputData.description = body.description;
        if (body.professionalName !== undefined) inputData.professionalName = body.professionalName;
        if (body.preparation !== undefined) inputData.preparation = body.preparation;
        if (body.documentsToTake !== undefined) inputData.documentsToTake = body.documentsToTake;
        if (body.transportArrangement !== undefined) inputData.transportArrangement = body.transportArrangement;
        if (body.recurrence !== undefined) {
          const recurrence = normalizeRecurrence(body.recurrence);
          if (recurrence !== undefined) {
            inputData.recurrence = recurrence;
          }
        }
        if (body.status !== undefined) inputData.status = body.status;
        if (body.notes !== undefined) inputData.notes = body.notes;

        const appointment = await useCases.createAppointmentUseCase.execute(inputData);

        return reply.status(201).send({
          status: 'success',
          data: appointment,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/appointments/:appointmentId - Update appointment (WRITE - tablets blocked)
  fastify.patch(
    '/v1/households/:householdId/appointments/:appointmentId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointments'],
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
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            type: {
              type: 'string',
              enum: ['doctor', 'specialist', 'dentist', 'lab', 'imaging', 'therapy', 'pharmacy', 'hospital', 'other']
            },
            date: { type: 'string' },
            time: { type: 'string' },
            duration: { type: ['number', 'null'] },
            seniorIds: { type: 'array', items: { type: 'string' }, minItems: 1 },
            caregiverId: { type: ['string', 'null'] },
            address: { type: ['string', 'null'], maxLength: 500 },
            locationName: { type: ['string', 'null'], maxLength: 255 },
            phoneNumber: { type: ['string', 'null'], maxLength: 50 },
            description: { type: ['string', 'null'], maxLength: 1000 },
            professionalName: { type: ['string', 'null'], maxLength: 255 },
            preparation: { type: ['string', 'null'], maxLength: 1000 },
            documentsToTake: { type: ['string', 'null'], maxLength: 500 },
            transportArrangement: { type: ['string', 'null'], maxLength: 500 },
            recurrence: { type: ['object', 'null'] },
            status: {
              type: 'string',
              enum: ['scheduled', 'confirmed', 'cancelled', 'completed', 'missed']
            },
            notes: { type: ['string', 'null'], maxLength: 1000 },
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
      const paramsResult = appointmentParamsSchema.safeParse(request.params);
      const bodyResult = updateAppointmentBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);

        const updateData: UpdateAppointmentInput = {};
        const body = bodyResult.data;

        if (body.title !== undefined) updateData.title = body.title;
        if (body.type !== undefined) updateData.type = body.type;
        if (body.date !== undefined) updateData.date = body.date;
        if (body.time !== undefined) updateData.time = body.time;
        if (body.duration !== undefined) updateData.duration = body.duration;
        if (body.seniorIds !== undefined) updateData.seniorIds = body.seniorIds;
        if (body.caregiverId !== undefined) updateData.caregiverId = body.caregiverId;
        if (body.address !== undefined) updateData.address = body.address;
        if (body.locationName !== undefined) updateData.locationName = body.locationName;
        if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
        if (body.description !== undefined) updateData.description = body.description;
        if (body.professionalName !== undefined) updateData.professionalName = body.professionalName;
        if (body.preparation !== undefined) updateData.preparation = body.preparation;
        if (body.documentsToTake !== undefined) updateData.documentsToTake = body.documentsToTake;
        if (body.transportArrangement !== undefined) updateData.transportArrangement = body.transportArrangement;
        if (body.recurrence !== undefined) {
          const recurrence = body.recurrence ? normalizeRecurrence(body.recurrence) : null;
          if (recurrence !== undefined) {
            updateData.recurrence = recurrence;
          }
        }
        if (body.status !== undefined) updateData.status = body.status;
        if (body.notes !== undefined) updateData.notes = body.notes;

        const appointment = await useCases.updateAppointmentUseCase.execute({
          appointmentId: paramsResult.data.appointmentId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          data: updateData,
        });

        return reply.status(200).send({
          status: 'success',
          data: appointment,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/appointments/:appointmentId - Delete appointment (WRITE - tablets blocked)
  fastify.delete(
    '/v1/households/:householdId/appointments/:appointmentId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointments'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            appointmentId: { type: 'string' },
          },
          required: ['householdId', 'appointmentId'],
        },
        response: {
          204: {
            type: 'null',
            description: 'Appointment deleted successfully',
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
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);

        await useCases.deleteAppointmentUseCase.execute({
          appointmentId: paramsResult.data.appointmentId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(204).send();
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/appointments/:appointmentId/reminders - Create appointment reminder (WRITE - tablets blocked)
  fastify.post(
    '/v1/households/:householdId/appointments/:appointmentId/reminders',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointment Reminders'],
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
          required: ['triggerBefore'],
          properties: {
            triggerBefore: { type: 'number' },
            customMessage: { type: 'string', maxLength: 500 },
            enabled: { type: 'boolean' },
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
      const paramsResult = appointmentParamsSchema.safeParse(request.params);
      const bodyResult = createAppointmentReminderBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);

        const body = bodyResult.data;
        const inputData: CreateAppointmentReminderInput & {
          householdId: string;
          requester: ReturnType<typeof getRequesterContext>;
        } = {
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          requester: getRequesterContext(request),
          triggerBefore: body.triggerBefore,
          enabled: body.enabled ?? true, // Default to true if not provided
        };

        if (body.customMessage !== undefined) inputData.customMessage = body.customMessage;

        const reminder = await useCases.createAppointmentReminderUseCase.execute(inputData);

        return reply.status(201).send({
          status: 'success',
          data: reminder,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/appointments/:appointmentId/reminders/:reminderId - Update reminder (WRITE - tablets blocked)
  fastify.patch(
    '/v1/households/:householdId/appointments/:appointmentId/reminders/:reminderId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointment Reminders'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            appointmentId: { type: 'string' },
            reminderId: { type: 'string' },
          },
          required: ['householdId', 'appointmentId', 'reminderId'],
        },
        body: {
          type: 'object',
          properties: {
            triggerBefore: { type: 'number' },
            customMessage: { type: ['string', 'null'], maxLength: 500 },
            enabled: { type: 'boolean' },
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
      const paramsResult = appointmentReminderParamsSchema.safeParse(request.params);
      const bodyResult = updateAppointmentReminderBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);

        const updateData: UpdateAppointmentReminderInput = {};
        const body = bodyResult.data;

        if (body.triggerBefore !== undefined) updateData.triggerBefore = body.triggerBefore;
        if (body.customMessage !== undefined) updateData.customMessage = body.customMessage;
        if (body.enabled !== undefined) updateData.enabled = body.enabled;

        const reminder = await useCases.updateAppointmentReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          appointmentId: paramsResult.data.appointmentId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          data: updateData,
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

  // DELETE /v1/households/:householdId/appointments/:appointmentId/reminders/:reminderId - Delete reminder (WRITE - tablets blocked)
  fastify.delete(
    '/v1/households/:householdId/appointments/:appointmentId/reminders/:reminderId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Appointment Reminders'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            appointmentId: { type: 'string' },
            reminderId: { type: 'string' },
          },
          required: ['householdId', 'appointmentId', 'reminderId'],
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
      const paramsResult = appointmentReminderParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);

        await useCases.deleteAppointmentReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          appointmentId: paramsResult.data.appointmentId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(204).send();
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
        // Verify tablet can only access its own household
        verifyTabletHouseholdAccess(request, reply, paramsResult.data.householdId);

        const appointment = await repository.getAppointmentById(
          paramsResult.data.appointmentId,
          paramsResult.data.householdId,
        );
        if (!appointment) {
          throw new NotFoundError('Appointment not found.');
        }

        const privacyContext = await buildHouseholdPrivacyContext(repository, paramsResult.data.householdId);
        const visibleAppointment = filterAppointmentsByPrivacy(
          [appointment],
          privacyContext,
          request.requester?.userId,
        );
        if (visibleAppointment.length === 0) {
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

        return reply.status(200).send({
          status: 'success',
          data: occurrences,
        });
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
            professionalName: { type: 'string', maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
            preparation: { type: 'string', maxLength: 1000 },
            documentsToTake: { type: 'string', maxLength: 500 },
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
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);

        const requester = getRequesterContext(request);
        const occurrence = await useCases.modifyOccurrenceUseCase.execute({
          userId: requester.userId,
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          occurrenceDate: paramsResult.data.occurrenceDate,
          overrides: (bodyResult.data.overrides || {}) as OccurrenceOverrides,
        });

        return reply.status(200).send({
          status: 'success',
          data: occurrence,
        });
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
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);

        const requester = getRequesterContext(request);
        const occurrence = await useCases.cancelOccurrenceUseCase.execute({
          userId: requester.userId,
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          occurrenceDate: paramsResult.data.occurrenceDate,
        });

        return reply.status(200).send({
          status: 'success',
          data: occurrence,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
