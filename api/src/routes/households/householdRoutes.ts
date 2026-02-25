import type { FastifyInstance } from 'fastify';
import type { CreateHouseholdUseCase } from '../../domain/usecases/CreateHouseholdUseCase.js';
import type { GetHouseholdOverviewUseCase } from '../../domain/usecases/GetHouseholdOverviewUseCase.js';
import type { ListHouseholdMembersUseCase } from '../../domain/usecases/ListHouseholdMembersUseCase.js';
import type { ListUserHouseholdsUseCase } from '../../domain/usecases/ListUserHouseholdsUseCase.js';
import { createHouseholdBodySchema, paramsSchema, errorResponseSchema } from './schemas.js';

export const registerHouseholdRoutes = (
  fastify: FastifyInstance,
  useCases: {
    createHouseholdUseCase: CreateHouseholdUseCase;
    getHouseholdOverviewUseCase: GetHouseholdOverviewUseCase;
    listUserHouseholdsUseCase: ListUserHouseholdsUseCase;
    listHouseholdMembersUseCase: ListHouseholdMembersUseCase;
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
        requester: request.requester,
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
        requester: request.requester,
      });

      return reply.status(200).send({
        status: 'success',
        data: households,
      });
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
                      createdByUserId: { type: 'string' },
                      createdAt: { type: 'string' },
                      updatedAt: { type: 'string' },
                    },
                    required: ['id', 'name', 'createdByUserId', 'createdAt', 'updatedAt'],
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
          requesterUserId: request.requester.userId,
        });

        return reply.status(200).send({
          status: 'success',
          data: overview,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        const statusCode = message === 'Access denied to this household.' ? 403 : 404;

        return reply.status(statusCode).send({
          status: 'error',
          message,
        });
      }
    },
  );

  // GET /v1/households/:householdId/members - List household members
  fastify.get(
    '/v1/households/:householdId/members',
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
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    role: { type: 'string', enum: ['senior', 'caregiver'] },
                    joinedAt: { type: 'string' },
                  },
                  required: ['id', 'firstName', 'lastName', 'role', 'joinedAt'],
                },
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
        const members = await useCases.listHouseholdMembersUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: request.requester,
        });

        return reply.status(200).send({
          status: 'success',
          data: members.map((member) => ({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            role: member.role,
            joinedAt: member.joinedAt,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';

        return reply.status(403).send({
          status: 'error',
          message,
        });
      }
    },
  );
};
