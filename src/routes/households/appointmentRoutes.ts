import type { FastifyInstance } from 'fastify';
import type { ListHouseholdAppointmentsUseCase } from '../../domain/usecases/appointments/ListHouseholdAppointmentsUseCase.js';
import type { CreateAppointmentUseCase } from '../../domain/usecases/appointments/CreateAppointmentUseCase.js';
import type { UpdateAppointmentUseCase } from '../../domain/usecases/appointments/UpdateAppointmentUseCase.js';
import type { DeleteAppointmentUseCase } from '../../domain/usecases/appointments/DeleteAppointmentUseCase.js';
import type { CreateAppointmentReminderUseCase } from '../../domain/usecases/appointments/CreateAppointmentReminderUseCase.js';
import type { UpdateAppointmentReminderUseCase } from '../../domain/usecases/appointments/UpdateAppointmentReminderUseCase.js';
import type { DeleteAppointmentReminderUseCase } from '../../domain/usecases/appointments/DeleteAppointmentReminderUseCase.js';
import { paramsSchema, errorResponseSchema } from './schemas.js';
import {
  createAppointmentBodySchema,
  updateAppointmentBodySchema,
  appointmentParamsSchema,
  appointmentReminderParamsSchema,
  createAppointmentReminderBodySchema,
  updateAppointmentReminderBodySchema,
} from './appointmentSchemas.js';
import { handleDomainError } from '../errorHandler.js';

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
  },
): void {
  // GET /v1/households/:householdId/appointments - List household appointments
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
        const appointments = await useCases.listHouseholdAppointmentsUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        });

        return reply.status(200).send({
          status: 'success',
          data: appointments,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/appointments - Create appointment
  fastify.post(
    '/v1/households/:householdId/appointments',
    {
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
      const bodyResult = createAppointmentBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const appointment = await useCases.createAppointmentUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          ...bodyResult.data,
        });

        return reply.status(201).send({
          status: 'success',
          data: appointment,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/appointments/:appointmentId - Update appointment
  fastify.patch(
    '/v1/households/:householdId/appointments/:appointmentId',
    {
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
      const paramsResult = appointmentParamsSchema.safeParse(request.params);
      const bodyResult = updateAppointmentBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const appointment = await useCases.updateAppointmentUseCase.execute({
          appointmentId: paramsResult.data.appointmentId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          data: bodyResult.data,
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

  // DELETE /v1/households/:householdId/appointments/:appointmentId - Delete appointment
  fastify.delete(
    '/v1/households/:householdId/appointments/:appointmentId',
    {
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
        await useCases.deleteAppointmentUseCase.execute({
          appointmentId: paramsResult.data.appointmentId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        });

        return reply.status(204).send();
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/appointments/:appointmentId/reminders - Create appointment reminder
  fastify.post(
    '/v1/households/:householdId/appointments/:appointmentId/reminders',
    {
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
      const paramsResult = appointmentParamsSchema.safeParse(request.params);
      const bodyResult = createAppointmentReminderBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const reminder = await useCases.createAppointmentReminderUseCase.execute({
          householdId: paramsResult.data.householdId,
          appointmentId: paramsResult.data.appointmentId,
          requester: request.requester,
          ...bodyResult.data,
        });

        return reply.status(201).send({
          status: 'success',
          data: reminder,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/appointments/:appointmentId/reminders/:reminderId - Update reminder
  fastify.patch(
    '/v1/households/:householdId/appointments/:appointmentId/reminders/:reminderId',
    {
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
      const paramsResult = appointmentReminderParamsSchema.safeParse(request.params);
      const bodyResult = updateAppointmentReminderBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const reminder = await useCases.updateAppointmentReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          appointmentId: paramsResult.data.appointmentId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          data: bodyResult.data,
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

  // DELETE /v1/households/:householdId/appointments/:appointmentId/reminders/:reminderId - Delete reminder
  fastify.delete(
    '/v1/households/:householdId/appointments/:appointmentId/reminders/:reminderId',
    {
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
        await useCases.deleteAppointmentReminderUseCase.execute({
          reminderId: paramsResult.data.reminderId,
          appointmentId: paramsResult.data.appointmentId,
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
