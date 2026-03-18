import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import { ListHouseholdDisplayTabletsUseCase } from '../../domain/usecases/displayTablets/ListHouseholdDisplayTabletsUseCase.js';
import { CreateDisplayTabletUseCase } from '../../domain/usecases/displayTablets/CreateDisplayTabletUseCase.js';
import { UpdateDisplayTabletUseCase } from '../../domain/usecases/displayTablets/UpdateDisplayTabletUseCase.js';
import { RevokeDisplayTabletUseCase } from '../../domain/usecases/displayTablets/RevokeDisplayTabletUseCase.js';
import { DeleteDisplayTabletUseCase } from '../../domain/usecases/displayTablets/DeleteDisplayTabletUseCase.js';
import { RegenerateDisplayTabletTokenUseCase } from '../../domain/usecases/displayTablets/RegenerateDisplayTabletTokenUseCase.js';
import { AuthenticateDisplayTabletUseCase } from '../../domain/usecases/displayTablets/AuthenticateDisplayTabletUseCase.js';
import { RefreshDisplayTabletSessionUseCase } from '../../domain/usecases/displayTablets/RefreshDisplayTabletSessionUseCase.js';
import { handleDomainError } from '../errorHandler.js';
import { requireUserAuth } from '../../plugins/authContext.js';
import { checkTabletAuthRateLimit } from './utils.js';

// Schemas
const householdParamsSchema = z.object({
  householdId: z.string().uuid(),
});

const householdTabletParamsSchema = z.object({
  householdId: z.string().uuid(),
  tabletId: z.string().uuid(),
});

const createTabletBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

const updateTabletBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
});

const authenticateTabletBodySchema = z.object({
  tabletId: z.string().uuid(),
  setupToken: z.string().length(64).optional(),
  token: z.string().length(64).optional(),
});

const refreshTabletSessionBodySchema = z.object({
  tabletId: z.string().uuid(),
  refreshToken: z.string().length(64),
});

export const registerDisplayTabletRoutes = (
  fastify: FastifyInstance,
  repository: HouseholdRepository,
) => {
  // 1. GET /v1/households/:householdId/display-tablets - List all tablets
  fastify.get(
    '/v1/households/:householdId/display-tablets',
    {
      preHandler: requireUserAuth,
      schema: {
        tags: ['Display Tablets'],
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
                    householdId: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: ['string', 'null'] },
                    status: { type: 'string', enum: ['active', 'revoked'] },
                    createdAt: { type: 'string' },
                    lastActiveAt: { type: ['string', 'null'] },
                    revokedAt: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = householdParamsSchema.parse(request.params);
        const useCase = new ListHouseholdDisplayTabletsUseCase(repository);

        const tablets = await useCase.execute({
          householdId: params.householdId,
          requesterUserId: request.requester!.userId,
        });

        // Remove internal actor IDs from response
        const sanitized = tablets.map(({ tokenHash, createdBy, revokedBy, ...tablet }) => tablet);

        return reply.status(200).send({
          status: 'success',
          data: sanitized,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 2. POST /v1/households/:householdId/display-tablets - Create a new tablet
  fastify.post(
    '/v1/households/:householdId/display-tablets',
    {
      preHandler: requireUserAuth,
      schema: {
        tags: ['Display Tablets'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
          },
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
                  householdId: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  token: { type: 'string' }, // ONLY returned at creation
                  status: { type: 'string', enum: ['active', 'revoked'] },
                  createdAt: { type: 'string' },
                  lastActiveAt: { type: ['string', 'null'] },
                  revokedAt: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = householdParamsSchema.parse(request.params);
        const body = createTabletBodySchema.parse(request.body);
        const useCase = new CreateDisplayTabletUseCase(repository);

        const tablet = await useCase.execute({
          householdId: params.householdId,
          name: body.name,
          ...(body.description !== undefined && { description: body.description }),
          requesterUserId: request.requester!.userId,
        });

        return reply.status(201).send({
          status: 'success',
          data: tablet,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 3. PATCH /v1/households/:householdId/display-tablets/:tabletId - Update tablet
  fastify.patch(
    '/v1/households/:householdId/display-tablets/:tabletId',
    {
      schema: {
        tags: ['Display Tablets'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            tabletId: { type: 'string' },
          },
          required: ['householdId', 'tabletId'],
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
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
                  id: { type: 'string' },
                  householdId: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  status: { type: 'string', enum: ['active', 'revoked'] },
                  createdAt: { type: 'string' },
                  lastActiveAt: { type: ['string', 'null'] },
                  revokedAt: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = householdTabletParamsSchema.parse(request.params);
        const body = updateTabletBodySchema.parse(request.body);
        const useCase = new UpdateDisplayTabletUseCase(repository);

        const tablet = await useCase.execute({
          householdId: params.householdId,
          tabletId: params.tabletId,
          ...(body.name !== undefined && { name: body.name }),
          ...(body.description !== undefined && { description: body.description }),
          requesterUserId: request.requester!.userId,
        });

        // Remove internal actor IDs from response
        const { tokenHash, createdBy, revokedBy, ...sanitized } = tablet;

        return reply.status(200).send({
          status: 'success',
          data: sanitized,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 4. POST /v1/households/:householdId/display-tablets/:tabletId/revoke - Revoke tablet
  fastify.post(
    '/v1/households/:householdId/display-tablets/:tabletId/revoke',
    {
      schema: {
        tags: ['Display Tablets'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            tabletId: { type: 'string' },
          },
          required: ['householdId', 'tabletId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = householdTabletParamsSchema.parse(request.params);
        const useCase = new RevokeDisplayTabletUseCase(repository);

        await useCase.execute({
          householdId: params.householdId,
          tabletId: params.tabletId,
          requesterUserId: request.requester!.userId,
        });

        return reply.status(200).send({
          status: 'success',
          message: 'Display tablet revoked successfully.',
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 5. DELETE /v1/households/:householdId/display-tablets/:tabletId - Delete revoked tablet
  fastify.delete(
    '/v1/households/:householdId/display-tablets/:tabletId',
    {
      schema: {
        tags: ['Display Tablets'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            tabletId: { type: 'string' },
          },
          required: ['householdId', 'tabletId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = householdTabletParamsSchema.parse(request.params);
        const useCase = new DeleteDisplayTabletUseCase(repository);

        await useCase.execute({
          householdId: params.householdId,
          tabletId: params.tabletId,
          requesterUserId: request.requester!.userId,
        });

        return reply.status(200).send({
          status: 'success',
          message: 'Display tablet deleted successfully.',
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 6. POST /v1/households/:householdId/display-tablets/:tabletId/regenerate-token - Regenerate token
  fastify.post(
    '/v1/households/:householdId/display-tablets/:tabletId/regenerate-token',
    {
      schema: {
        tags: ['Display Tablets'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            tabletId: { type: 'string' },
          },
          required: ['householdId', 'tabletId'],
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
                  householdId: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: ['string', 'null'] },
                  token: { type: 'string' }, // New token returned
                  status: { type: 'string', enum: ['active', 'revoked'] },
                  createdAt: { type: 'string' },
                  lastActiveAt: { type: ['string', 'null'] },
                  revokedAt: { type: ['string', 'null'] },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = householdTabletParamsSchema.parse(request.params);
        const useCase = new RegenerateDisplayTabletTokenUseCase(repository);

        const tablet = await useCase.execute({
          householdId: params.householdId,
          tabletId: params.tabletId,
          requesterUserId: request.requester!.userId,
        });

        return reply.status(200).send({
          status: 'success',
          data: tablet,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 7. POST /v1/display-tablets/authenticate - Authenticate a tablet (NO USER AUTH REQUIRED)
  fastify.post(
    '/v1/display-tablets/authenticate',
    {
      schema: {
        tags: ['Display Tablets'],
        body: {
          type: 'object',
          properties: {
            tabletId: { type: 'string' },
            setupToken: { type: 'string', minLength: 64, maxLength: 64 },
            token: { type: 'string', minLength: 64, maxLength: 64 },
          },
          required: ['tabletId'],
          anyOf: [
            { required: ['tabletId', 'setupToken'] },
            { required: ['tabletId', 'token'] },
          ],
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
                  householdName: { type: 'string' },
                  permissions: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  sessionToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['error'] },
              message: { type: 'string' },
            },
          },
          429: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['error'] },
              message: { type: 'string' },
            },
          },
        },
      },
      // This endpoint should NOT require user authentication
      preHandler: async () => undefined,
    },
    async (request, reply) => {
      try {
        const body = authenticateTabletBodySchema.parse(request.body);
        const setupToken = body.setupToken ?? body.token;
        if (!setupToken) {
          return (reply as FastifyReply).status(400).send({
            status: 'error',
            message: 'setupToken is required.',
          });
        }
        const rateLimitKey = `${request.ip}:${body.tabletId}`;

        if (!checkTabletAuthRateLimit(rateLimitKey)) {
          fastify.log.warn({ tabletId: body.tabletId, ip: request.ip }, 'Display tablet authentication rate limit reached');
          return (reply as FastifyReply).status(429).send({
            status: 'error',
            message: 'Tablet authentication rate limit reached. Please try again later.',
          });
        }

        const useCase = new AuthenticateDisplayTabletUseCase(repository);

        const result = await useCase.execute({
          tabletId: body.tabletId,
          setupToken,
        });

        fastify.log.info({
          tabletId: body.tabletId,
          householdId: result.householdId,
          ip: request.ip,
        }, 'Display tablet authenticated successfully');

        return reply.status(200).send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  fastify.post(
    '/v1/display-tablets/session/refresh',
    {
      schema: {
        tags: ['Display Tablets'],
        body: {
          type: 'object',
          properties: {
            tabletId: { type: 'string' },
            refreshToken: { type: 'string', minLength: 64, maxLength: 64 },
          },
          required: ['tabletId', 'refreshToken'],
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
                  householdName: { type: 'string' },
                  permissions: { type: 'array', items: { type: 'string' } },
                  sessionToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: async () => undefined,
    },
    async (request, reply) => {
      try {
        const body = refreshTabletSessionBodySchema.parse(request.body);
        const useCase = new RefreshDisplayTabletSessionUseCase(repository);
        const result = await useCase.execute(body);

        return reply.status(200).send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

};
