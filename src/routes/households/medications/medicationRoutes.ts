import type { FastifyInstance } from 'fastify';
import type { UpdateMedicationInput } from '../../../domain/entities/Medication.js';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { ListHouseholdMedicationsUseCase } from '../../../domain/usecases/medications/ListHouseholdMedicationsUseCase.js';
import type { CreateMedicationUseCase } from '../../../domain/usecases/medications/CreateMedicationUseCase.js';
import type { UpdateMedicationUseCase } from '../../../domain/usecases/medications/UpdateMedicationUseCase.js';
import type { DeleteMedicationUseCase } from '../../../domain/usecases/medications/DeleteMedicationUseCase.js';
import { paramsSchema, errorResponseSchema } from '../householdSchemas.js';
import {
  createMedicationBodySchema,
  updateMedicationBodySchema,
  medicationParamsSchema,
  medicationResponseSchema,
} from './medicationSchemas.js';
import { handleDomainError } from '../../errorHandler.js';
import { requireWritePermission } from '../../../plugins/authContext.js';
import { ensureHouseholdPermission, verifyTabletHouseholdAccess, getRequesterContext } from '../utils.js';
import {
  assertRequesterCanShareHealthData,
  buildHouseholdPrivacyContext,
  filterMedicationsByPrivacy,
} from '../../../domain/services/privacyFilter.js';

export function registerMedicationRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  useCases: {
    listHouseholdMedicationsUseCase: ListHouseholdMedicationsUseCase;
    createMedicationUseCase: CreateMedicationUseCase;
    updateMedicationUseCase: UpdateMedicationUseCase;
    deleteMedicationUseCase: DeleteMedicationUseCase;
  },
): void {
  type CreateMedicationRouteInput = Parameters<CreateMedicationUseCase['execute']>[0];

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
              data: {
                type: 'array',
                items: medicationResponseSchema,
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
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        // Verify tablet can only access its own household
        verifyTabletHouseholdAccess(request, reply, paramsResult.data.householdId);

        const medications = await useCases.listHouseholdMedicationsUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });
        const privacyContext = await buildHouseholdPrivacyContext(repository, paramsResult.data.householdId);
        const filteredMedications = filterMedicationsByPrivacy(
          medications,
          privacyContext,
          request.requester?.userId,
        );

        return reply.status(200).send({
          status: 'success',
          data: filteredMedications,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/medications - Create medication (WRITE - tablets blocked)
  fastify.post(
    '/v1/households/:householdId/medications',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Medications'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          required: ['name', 'dosage', 'form', 'frequency', 'startDate'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            dosage: { type: 'string', minLength: 1, maxLength: 100 },
            form: {
              type: 'string',
              enum: ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'cream', 'patch', 'inhaler', 'suppository', 'other']
            },
            frequency: { type: 'string', minLength: 1, maxLength: 200 },
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
              data: medicationResponseSchema,
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
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageMedications');
        const inputData: CreateMedicationRouteInput = {
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          seniorId: bodyResult.data.seniorId,
          name: bodyResult.data.name,
          dosage: bodyResult.data.dosage,
          form: bodyResult.data.form,
          frequency: bodyResult.data.frequency,
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
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/medications/:medicationId - Update medication (WRITE - tablets blocked)
  fastify.patch(
    '/v1/households/:householdId/medications/:medicationId',
    {
      preHandler: requireWritePermission,
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
              data: medicationResponseSchema,
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
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageMedications');
        const updateData: UpdateMedicationInput = {};
        const body = bodyResult.data;

        if (body.name !== undefined) updateData.name = body.name;
        if (body.dosage !== undefined) updateData.dosage = body.dosage;
        if (body.form !== undefined) updateData.form = body.form;
        if (body.frequency !== undefined) updateData.frequency = body.frequency;
        if (body.prescribedBy !== undefined) updateData.prescribedBy = body.prescribedBy;
        if (body.prescriptionDate !== undefined) updateData.prescriptionDate = body.prescriptionDate;
        if (body.startDate !== undefined) updateData.startDate = body.startDate;
        if (body.endDate !== undefined) updateData.endDate = body.endDate;
        if (body.instructions !== undefined) updateData.instructions = body.instructions;

        const medication = await useCases.updateMedicationUseCase.execute({
          medicationId: paramsResult.data.medicationId,
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
          data: updateData,
        });

        return reply.status(200).send({
          status: 'success',
          data: medication,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/medications/:medicationId - Delete medication (WRITE - tablets blocked)
  fastify.delete(
    '/v1/households/:householdId/medications/:medicationId',
    {
      preHandler: requireWritePermission,
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
          204: {
            type: 'null',
            description: 'Medication deleted successfully',
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
        await assertRequesterCanShareHealthData(repository, request.requester!.userId);
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageMedications');
        await useCases.deleteMedicationUseCase.execute({
          medicationId: paramsResult.data.medicationId,
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
