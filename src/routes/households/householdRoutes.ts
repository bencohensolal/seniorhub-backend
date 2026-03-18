import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CreateHouseholdUseCase } from '../../domain/usecases/households/CreateHouseholdUseCase.js';
import type { GetHouseholdOverviewUseCase } from '../../domain/usecases/households/GetHouseholdOverviewUseCase.js';
import type { ListUserHouseholdsUseCase } from '../../domain/usecases/households/ListUserHouseholdsUseCase.js';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import { createHouseholdBodySchema, paramsSchema, errorResponseSchema } from './householdSchemas.js';
import { handleDomainError } from '../errorHandler.js';
import { ensureHouseholdPermission, getRequesterContext } from './utils.js';
import { requireWritePermission } from '../../plugins/authContext.js';
import type {
  HouseholdMemberPermissions,
  HouseholdNotificationSettings,
  UpdateHouseholdSettingsInput,
} from '../../domain/entities/HouseholdSettings.js';

const householdNotificationsSchema = z.object({
  enabled: z.boolean().optional(),
  memberUpdates: z.boolean().optional(),
  invitations: z.boolean().optional(),
});

const memberPermissionsSchema = z.object({
  manageMedications: z.boolean().optional(),
  manageAppointments: z.boolean().optional(),
  manageTasks: z.boolean().optional(),
  manageMembers: z.boolean().optional(),
  viewSensitiveInfo: z.boolean().optional(),
});

const updateHouseholdSettingsBodySchema = z.object({
  notifications: householdNotificationsSchema.optional(),
  memberPermissions: z.record(z.string(), memberPermissionsSchema).optional(),
});

export const registerHouseholdRoutes = (
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  useCases: {
    createHouseholdUseCase: CreateHouseholdUseCase;
    getHouseholdOverviewUseCase: GetHouseholdOverviewUseCase;
    listUserHouseholdsUseCase: ListUserHouseholdsUseCase;
  },
) => {
  // POST /v1/households - Create a new household
  fastify.post(
    '/v1/households',
    {
      schema: {
        tags: ['Households'],
        body: {
          type: 'object',
          properties: { name: { type: 'string', minLength: 2, maxLength: 120 } },
          required: ['name'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['id', 'name', 'createdAt', 'updatedAt'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const payloadResult = createHouseholdBodySchema.safeParse(request.body);
      if (!payloadResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      const household = await useCases.createHouseholdUseCase.execute({
        name: payloadResult.data.name,
        requester: getRequesterContext(request),
      });

      return reply.status(201).send({
        status: 'success',
        data: household,
      });
    },
  );

  // GET /v1/households/my-households - List user's households
  fastify.get(
    '/v1/households/my-households',
    {
      schema: {
        tags: ['Households'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    householdId: { type: 'string' },
                    householdName: { type: 'string' },
                    myRole: { type: 'string', enum: ['senior', 'caregiver'] },
                    joinedAt: { type: 'string' },
                    memberCount: { type: 'number' },
                  },
                  required: ['householdId', 'householdName', 'myRole', 'joinedAt', 'memberCount'],
                },
              },
            },
            required: ['status', 'data'],
          },
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const households = await useCases.listUserHouseholdsUseCase.execute({
        requester: getRequesterContext(request),
      });

      return reply.status(200).send({
        status: 'success',
        data: households,
      });
    },
  );

  // GET /v1/households/:householdId - Get household details
  fastify.get(
    '/v1/households/:householdId',
    {
      schema: {
        tags: ['Households'],
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
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  createdAt: { type: 'string' },
                  memberCount: { type: 'number' },
                },
                required: ['id', 'name', 'createdAt', 'memberCount'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
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
        const overview = await useCases.getHouseholdOverviewUseCase.execute({
          householdId: paramsResult.data.householdId,
          requesterUserId: request.requester!.userId,
        });

        return reply.status(200).send({
          status: 'success',
          data: {
            id: overview.household.id,
            name: overview.household.name,
            createdAt: overview.household.createdAt,
            memberCount: overview.membersCount,
          },
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId - Update household
  fastify.patch(
    '/v1/households/:householdId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Households'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          properties: { name: { type: 'string', minLength: 2, maxLength: 120 } },
          required: ['name'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  createdByUserId: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['id', 'name', 'createdByUserId', 'createdAt', 'updatedAt'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const bodyResult = createHouseholdBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageMembers');
        const household = await repository.updateHouseholdName(
          paramsResult.data.householdId,
          bodyResult.data.name,
        );

        return reply.status(200).send({
          status: 'success',
          data: household,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // GET /v1/households/:householdId/overview - Get household overview
  fastify.get(
    '/v1/households/:householdId/overview',
    {
      schema: {
        tags: ['Households'],
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
                type: 'object',
                properties: {
                  household: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      createdAt: { type: 'string' },
                      updatedAt: { type: 'string' },
                    },
                    required: ['id', 'name', 'createdAt', 'updatedAt'],
                  },
                  membersCount: { type: 'number' },
                  seniorsCount: { type: 'number' },
                  caregiversCount: { type: 'number' },
                },
                required: ['household', 'membersCount', 'seniorsCount', 'caregiversCount'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
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
        const overview = await useCases.getHouseholdOverviewUseCase.execute({
          householdId: paramsResult.data.householdId,
          requesterUserId: request.requester!.userId,
        });

        return reply.status(200).send({
          status: 'success',
          data: overview,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // GET /v1/households/:householdId/settings
  fastify.get(
    '/v1/households/:householdId/settings',
    {
      schema: {
        tags: ['Households'],
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
                type: 'object',
                properties: {
                  householdId: { type: 'string' },
                  memberPermissions: { type: 'object', additionalProperties: true },
                  notifications: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      memberUpdates: { type: 'boolean' },
                      invitations: { type: 'boolean' },
                    },
                    required: ['enabled', 'memberUpdates', 'invitations'],
                  },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['householdId', 'memberPermissions', 'notifications', 'createdAt', 'updatedAt'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
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
        const requester = request.requester;
        if (!requester) {
          return reply.status(401).send({ status: 'error', message: 'Authentication required.' });
        }
        const member = await repository.findActiveMemberByUserInHousehold(requester.userId, paramsResult.data.householdId);
        if (!member) {
          return reply.status(403).send({ status: 'error', message: 'Access denied to this household.' });
        }

        const settings = await repository.getHouseholdSettings(paramsResult.data.householdId);
        return reply.status(200).send({ status: 'success', data: settings });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PUT /v1/households/:householdId/settings
  fastify.put(
    '/v1/households/:householdId/settings',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Households'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          properties: {
            notifications: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                memberUpdates: { type: 'boolean' },
                invitations: { type: 'boolean' },
              },
            },
            memberPermissions: { type: 'object', additionalProperties: true },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  householdId: { type: 'string' },
                  memberPermissions: { type: 'object', additionalProperties: true },
                  notifications: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      memberUpdates: { type: 'boolean' },
                      invitations: { type: 'boolean' },
                    },
                    required: ['enabled', 'memberUpdates', 'invitations'],
                  },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['householdId', 'memberPermissions', 'notifications', 'createdAt', 'updatedAt'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const bodyResult = updateHouseholdSettingsBodySchema.safeParse(request.body);

      if (!paramsResult.success || !bodyResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await ensureHouseholdPermission(request, repository, paramsResult.data.householdId, 'manageMembers');
        const payload: UpdateHouseholdSettingsInput = {
          ...(bodyResult.data.notifications && {
            notifications: bodyResult.data.notifications as Partial<HouseholdNotificationSettings>,
          }),
          ...(bodyResult.data.memberPermissions && {
            memberPermissions: bodyResult.data.memberPermissions as Record<string, Partial<HouseholdMemberPermissions>>,
          }),
        };
        const settings = await repository.updateHouseholdSettings(paramsResult.data.householdId, payload);
        return reply.status(200).send({ status: 'success', data: settings });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

};
