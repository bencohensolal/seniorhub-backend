import type { FastifyInstance } from 'fastify';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { ListEmergencyContactsUseCase } from '../../../domain/usecases/emergencyContacts/ListEmergencyContactsUseCase.js';
import type { CreateEmergencyContactUseCase } from '../../../domain/usecases/emergencyContacts/CreateEmergencyContactUseCase.js';
import type { UpdateEmergencyContactUseCase } from '../../../domain/usecases/emergencyContacts/UpdateEmergencyContactUseCase.js';
import type { DeleteEmergencyContactUseCase } from '../../../domain/usecases/emergencyContacts/DeleteEmergencyContactUseCase.js';
import type { ReorderEmergencyContactsUseCase } from '../../../domain/usecases/emergencyContacts/ReorderEmergencyContactsUseCase.js';
import type { TriggerEmergencyAlertUseCase } from '../../../domain/usecases/emergencyContacts/TriggerEmergencyAlertUseCase.js';
import { handleDomainError } from '../../errorHandler.js';
import { getRequesterContext } from '../utils.js';

const errorResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
  },
  required: ['status', 'message'],
};

const emergencyContactSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    householdId: { type: 'string' },
    name: { type: 'string' },
    phone: { type: 'string' },
    relationship: { type: ['string', 'null'] },
    priorityOrder: { type: 'integer' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
  },
};

export function registerEmergencyContactRoutes(
  fastify: FastifyInstance,
  _repository: HouseholdRepository,
  useCases: {
    listEmergencyContactsUseCase: ListEmergencyContactsUseCase;
    createEmergencyContactUseCase: CreateEmergencyContactUseCase;
    updateEmergencyContactUseCase: UpdateEmergencyContactUseCase;
    deleteEmergencyContactUseCase: DeleteEmergencyContactUseCase;
    reorderEmergencyContactsUseCase: ReorderEmergencyContactsUseCase;
    triggerEmergencyAlertUseCase: TriggerEmergencyAlertUseCase;
  },
): void {
  // GET /v1/households/:householdId/emergency-contacts - List emergency contacts
  fastify.get(
    '/v1/households/:householdId/emergency-contacts',
    {
      schema: {
        tags: ['Emergency Contacts'],
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
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { householdId } = request.params as { householdId: string };
      try {
        const requester = getRequesterContext(request);
        const contacts = await useCases.listEmergencyContactsUseCase.execute(householdId, requester.userId);
        return reply.status(200).send({ status: 'success', data: contacts });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/emergency-contacts - Create emergency contact
  fastify.post(
    '/v1/households/:householdId/emergency-contacts',
    {
      schema: {
        tags: ['Emergency Contacts'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            phone: { type: 'string', minLength: 1, maxLength: 50 },
            relationship: { type: 'string', maxLength: 100 },
            priorityOrder: { type: 'integer', minimum: 0 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: emergencyContactSchema,
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
      const { householdId } = request.params as { householdId: string };
      const body = request.body as {
        name: string;
        phone: string;
        relationship?: string;
        priorityOrder?: number;
      };
      try {
        const requester = getRequesterContext(request);
        const contact = await useCases.createEmergencyContactUseCase.execute({
          householdId,
          name: body.name,
          phone: body.phone,
          ...(body.relationship !== undefined && { relationship: body.relationship }),
          ...(body.priorityOrder !== undefined && { priorityOrder: body.priorityOrder }),
          requesterUserId: requester.userId,
        });
        return reply.status(201).send({ status: 'success', data: contact });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PUT /v1/households/:householdId/emergency-contacts/reorder - Reorder emergency contacts
  // IMPORTANT: This route must be registered BEFORE the :contactId route
  fastify.put(
    '/v1/households/:householdId/emergency-contacts/reorder',
    {
      schema: {
        tags: ['Emergency Contacts'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          required: ['orderedIds'],
          properties: {
            orderedIds: { type: 'array', items: { type: 'string' } },
          },
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
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { householdId } = request.params as { householdId: string };
      const body = request.body as { orderedIds: string[] };
      try {
        const requester = getRequesterContext(request);
        await useCases.reorderEmergencyContactsUseCase.execute({
          householdId,
          orderedIds: body.orderedIds,
          requesterUserId: requester.userId,
        });
        return reply.status(200).send({ status: 'success' });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PUT /v1/households/:householdId/emergency-contacts/:contactId - Update emergency contact
  fastify.put(
    '/v1/households/:householdId/emergency-contacts/:contactId',
    {
      schema: {
        tags: ['Emergency Contacts'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            contactId: { type: 'string' },
          },
          required: ['householdId', 'contactId'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            phone: { type: 'string', minLength: 1, maxLength: 50 },
            relationship: { type: 'string', maxLength: 100 },
            priorityOrder: { type: 'integer', minimum: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: emergencyContactSchema,
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
      const { householdId, contactId } = request.params as { householdId: string; contactId: string };
      const body = request.body as {
        name?: string;
        phone?: string;
        relationship?: string;
        priorityOrder?: number;
      };
      try {
        const requester = getRequesterContext(request);
        const contact = await useCases.updateEmergencyContactUseCase.execute({
          contactId,
          householdId,
          input: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.phone !== undefined && { phone: body.phone }),
            ...(body.relationship !== undefined && { relationship: body.relationship }),
            ...(body.priorityOrder !== undefined && { priorityOrder: body.priorityOrder }),
          },
          requesterUserId: requester.userId,
        });
        return reply.status(200).send({ status: 'success', data: contact });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/emergency-contacts/:contactId - Delete emergency contact
  fastify.delete(
    '/v1/households/:householdId/emergency-contacts/:contactId',
    {
      schema: {
        tags: ['Emergency Contacts'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            contactId: { type: 'string' },
          },
          required: ['householdId', 'contactId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
            },
            required: ['status'],
          },
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { householdId, contactId } = request.params as { householdId: string; contactId: string };
      try {
        const requester = getRequesterContext(request);
        await useCases.deleteEmergencyContactUseCase.execute({
          contactId,
          householdId,
          requesterUserId: requester.userId,
        });
        return reply.status(200).send({ status: 'success' });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/emergency-alert - Trigger emergency alert
  fastify.post(
    '/v1/households/:householdId/emergency-alert',
    {
      schema: {
        tags: ['Emergency Contacts'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok'] },
              tokensSent: { type: 'integer' },
              smsSent: { type: 'integer' },
            },
            required: ['status', 'tokensSent', 'smsSent'],
          },
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { householdId } = request.params as { householdId: string };
      try {
        const requester = getRequesterContext(request);
        const result = await useCases.triggerEmergencyAlertUseCase.execute(householdId, requester.userId);
        return reply.status(200).send({ status: 'ok', tokensSent: result.tokensSent });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
