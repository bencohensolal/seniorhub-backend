import type { FastifyInstance } from 'fastify';
import type { ListHouseholdMedicationsUseCase } from '../../domain/usecases/ListHouseholdMedicationsUseCase.js';
import type { CreateMedicationUseCase } from '../../domain/usecases/CreateMedicationUseCase.js';
import type { UpdateMedicationUseCase } from '../../domain/usecases/UpdateMedicationUseCase.js';
import type { DeleteMedicationUseCase } from '../../domain/usecases/DeleteMedicationUseCase.js';
import { paramsSchema, errorResponseSchema } from './schemas.js';
import {
  createMedicationBodySchema,
  updateMedicationBodySchema,
  medicationParamsSchema,
} from './medicationSchemas.js';

export function registerMedicationRoutes(
  fastify: FastifyInstance,
  useCases: {
    listHouseholdMedicationsUseCase: ListHouseholdMedicationsUseCase;
    createMedicationUseCase: CreateMedicationUseCase;
    updateMedicationUseCase: UpdateMedicationUseCase;
    deleteMedicationUseCase: DeleteMedicationUseCase;
  },
): void {
  // GET /v1/households/:householdId/medications - List household medications
  fastify.get(
    '/v1/households/:householdId/medications',
    {
      schema: {
        tags: ['Medications'],
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
        const medications = await useCases.listHouseholdMedicationsUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        });

        return reply.status(200).send({
          status: 'success',
          data: medications,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        const statusCode = message.includes('Access denied') ? 403 : 500;

        return reply.status(statusCode).send({
          status: 'error',
          message,
        });
      }
    },
  );

  // POST /v1/households/:householdId/medications - Create medication
  fastify.post(
    '/v1/households/:householdId/medications',
    {
      schema: {
        tags: ['Medications'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          required: ['name', 'dosage', 'form', 'frequency', 'schedule', 'startDate'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            dosage: { type: 'string', minLength: 1, maxLength: 100 },
            form: { 
              type: 'string', 
              enum: ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'cream', 'patch', 'inhaler', 'suppository', 'other'] 
            },
            frequency: { type: 'string', minLength: 1, maxLength: 200 },
            schedule: { type: 'array', items: { type: 'string' }, minItems: 1 },
            prescribedBy: { type: 'string', maxLength: 200 },
            prescriptionDate: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            instructions: { type: 'string', maxLength: 1000 },
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
      const bodyResult = createMedicationBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const inputData: any = {
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          name: bodyResult.data.name,
          dosage: bodyResult.data.dosage,
          form: bodyResult.data.form,
          frequency: bodyResult.data.frequency,
          schedule: bodyResult.data.schedule,
          startDate: bodyResult.data.startDate,
        };

        if (bodyResult.data.prescribedBy) inputData.prescribedBy = bodyResult.data.prescribedBy;
        if (bodyResult.data.prescriptionDate) inputData.prescriptionDate = bodyResult.data.prescriptionDate;
        if (bodyResult.data.endDate) inputData.endDate = bodyResult.data.endDate;
        if (bodyResult.data.instructions) inputData.instructions = bodyResult.data.instructions;

        const medication = await useCases.createMedicationUseCase.execute(inputData);

        return reply.status(201).send({
          status: 'success',
          data: medication,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        const statusCode = message.includes('Access denied') || message.includes('only caregivers') ? 403 : 500;

        return reply.status(statusCode).send({
          status: 'error',
          message,
        });
      }
    },
  );

  // PATCH /v1/households/:householdId/medications/:medicationId - Update medication
  fastify.patch(
    '/v1/households/:householdId/medications/:medicationId',
    {
      schema: {
        tags: ['Medications'],
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
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            dosage: { type: 'string', minLength: 1, maxLength: 100 },
            form: { 
              type: 'string', 
              enum: ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'cream', 'patch', 'inhaler', 'suppository', 'other'] 
            },
            frequency: { type: 'string', minLength: 1, maxLength: 200 },
            schedule: { type: 'array', items: { type: 'string' }, minItems: 1 },
            prescribedBy: { type: ['string', 'null'], maxLength: 200 },
            prescriptionDate: { type: ['string', 'null'] },
            startDate: { type: 'string' },
            endDate: { type: ['string', 'null'] },
            instructions: { type: ['string', 'null'], maxLength: 1000 },
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
      const paramsResult = medicationParamsSchema.safeParse(request.params);
      const bodyResult = updateMedicationBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const updateData: any = {};
        const body = bodyResult.data;

        if (body.name !== undefined) updateData.name = body.name;
        if (body.dosage !== undefined) updateData.dosage = body.dosage;
        if (body.form !== undefined) updateData.form = body.form;
        if (body.frequency !== undefined) updateData.frequency = body.frequency;
        if (body.schedule !== undefined) updateData.schedule = body.schedule;
        if (body.prescribedBy !== undefined) updateData.prescribedBy = body.prescribedBy;
        if (body.prescriptionDate !== undefined) updateData.prescriptionDate = body.prescriptionDate;
        if (body.startDate !== undefined) updateData.startDate = body.startDate;
        if (body.endDate !== undefined) updateData.endDate = body.endDate;
        if (body.instructions !== undefined) updateData.instructions = body.instructions;

        const medication = await useCases.updateMedicationUseCase.execute({
          medicationId: paramsResult.data.medicationId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          data: updateData,
        });

        return reply.status(200).send({
          status: 'success',
          data: medication,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        
        if (message.includes('Access denied') || message.includes('only caregivers')) {
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

  // DELETE /v1/households/:householdId/medications/:medicationId - Delete medication
  fastify.delete(
    '/v1/households/:householdId/medications/:medicationId',
    {
      schema: {
        tags: ['Medications'],
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
            },
            required: ['status'],
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
        await useCases.deleteMedicationUseCase.execute({
          medicationId: paramsResult.data.medicationId,
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        });

        return reply.status(200).send({
          status: 'success',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        
        if (message.includes('Access denied') || message.includes('only caregivers')) {
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
