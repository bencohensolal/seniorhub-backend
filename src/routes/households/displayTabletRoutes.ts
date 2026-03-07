import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import { ListHouseholdDisplayTabletsUseCase } from '../../domain/usecases/displayTablets/ListHouseholdDisplayTabletsUseCase.js';
import { CreateDisplayTabletUseCase } from '../../domain/usecases/displayTablets/CreateDisplayTabletUseCase.js';
import { UpdateDisplayTabletUseCase } from '../../domain/usecases/displayTablets/UpdateDisplayTabletUseCase.js';
import { RevokeDisplayTabletUseCase } from '../../domain/usecases/displayTablets/RevokeDisplayTabletUseCase.js';
import { DeleteDisplayTabletUseCase } from '../../domain/usecases/displayTablets/DeleteDisplayTabletUseCase.js';
import { RegenerateDisplayTabletTokenUseCase } from '../../domain/usecases/displayTablets/RegenerateDisplayTabletTokenUseCase.js';
import { AuthenticateDisplayTabletUseCase } from '../../domain/usecases/displayTablets/AuthenticateDisplayTabletUseCase.js';
import { handleDomainError } from '../errorHandler.js';
import { requireUserAuth } from '../../plugins/authContext.js';
import { tabletDisplayConfigSchema, validateScreenSettings } from './displayTabletConfigSchemas.js';
import { ValidationError } from '../../domain/errors/index.js';
import { tabletConfigNotifier } from '../../domain/services/tabletConfigNotifier.js';
import { GetTabletConfigUseCase } from '../../domain/usecases/displayTablets/GetTabletConfigUseCase.js';

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
  token: z.string().length(64), // 64 hex characters
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
                    createdBy: { type: 'string' },
                    lastActiveAt: { type: ['string', 'null'] },
                    revokedAt: { type: ['string', 'null'] },
                    revokedBy: { type: ['string', 'null'] },
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

        // Remove tokenHash from response
        const sanitized = tablets.map(({ tokenHash, ...tablet }) => tablet);

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
                  createdBy: { type: 'string' },
                  lastActiveAt: { type: ['string', 'null'] },
                  revokedAt: { type: ['string', 'null'] },
                  revokedBy: { type: ['string', 'null'] },
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
                  createdBy: { type: 'string' },
                  lastActiveAt: { type: ['string', 'null'] },
                  revokedAt: { type: ['string', 'null'] },
                  revokedBy: { type: ['string', 'null'] },
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

        // Remove tokenHash from response
        const { tokenHash, ...sanitized } = tablet;

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
                  createdBy: { type: 'string' },
                  lastActiveAt: { type: ['string', 'null'] },
                  revokedAt: { type: ['string', 'null'] },
                  revokedBy: { type: ['string', 'null'] },
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
            token: { type: 'string', minLength: 64, maxLength: 64 },
          },
          required: ['tabletId', 'token'],
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
                },
              },
            },
          },
        },
      },
      // This endpoint should NOT require user authentication
      preHandler: async (request, reply) => {
        // Bypass authentication for this specific endpoint
        // The tablet will authenticate using its own credentials
        return;
      },
    },
    async (request, reply) => {
      try {
        const body = authenticateTabletBodySchema.parse(request.body);
        const useCase = new AuthenticateDisplayTabletUseCase(repository);

        const result = await useCase.execute({
          tabletId: body.tabletId,
          token: body.token,
        });

        return reply.status(200).send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 8. GET /v1/households/:householdId/display-tablets/:tabletId/config - Get tablet configuration
  fastify.get(
    '/v1/households/:householdId/display-tablets/:tabletId/config',
    {
      preHandler: async (request: any, reply: any) => {
        // Allow both user auth and tablet auth
        // Tablets can only read their own config
        if (request.tabletSession) {
          // Tablet authentication - validate it's reading its own config
          const params = request.params as any;
          if (request.tabletSession.tabletId !== params.tabletId) {
            return reply.status(403).send({
              status: 'error',
              message: 'Tablets can only read their own configuration.',
            });
          }
          if (request.tabletSession.householdId !== params.householdId) {
            return reply.status(403).send({
              status: 'error',
              message: 'Tablet does not belong to this household.',
            });
          }
          return; // Tablet is authorized
        }
        
        // User authentication required if not tablet
        if (!request.requester) {
          return reply.status(401).send({
            status: 'error',
            message: 'Authentication required. Provide user credentials or tablet session.',
          });
        }
      },
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
        // Don't define response schema to allow dynamic config structure
      },
    },
    async (request, reply) => {
      try {
        const params = householdTabletParamsSchema.parse(request.params);

        // Use GetTabletConfigUseCase to get complete config including photo screens
        const useCase = new GetTabletConfigUseCase(repository);
        const config = await useCase.execute({
          householdId: params.householdId,
          tabletId: params.tabletId,
        });

        // Return config (can be null if not yet configured)
        return reply.status(200).send({
          success: true,
          data: config,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 9. PUT /v1/households/:householdId/display-tablets/:tabletId/config - Update tablet configuration
  fastify.put(
    '/v1/households/:householdId/display-tablets/:tabletId/config',
    {
      preHandler: requireUserAuth,
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
            slideDuration: { type: 'number' },
            dataCacheDuration: { type: 'number' },
            dataRefreshInterval: { type: 'number' },
            screens: { type: 'array' },
          },
          required: ['slideDuration', 'dataCacheDuration', 'dataRefreshInterval', 'screens'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = householdTabletParamsSchema.parse(request.params);
        
        // Validate the configuration
        const configData = tabletDisplayConfigSchema.parse(request.body);
        
        // Validate screen-specific settings
        for (const screen of configData.screens) {
          if (!validateScreenSettings(screen)) {
            throw new ValidationError(`Invalid settings for screen type: ${screen.type}`);
          }
        }

        // Add lastUpdated timestamp
        const configWithTimestamp = {
          ...configData,
          lastUpdated: new Date().toISOString(),
        };

        // Update the config
        const tablet = await repository.updateDisplayTabletConfig(
          params.tabletId,
          params.householdId,
          configWithTimestamp,
        );

        // Notify the tablet in real-time if connected via SSE
        tabletConfigNotifier.notifyConfigUpdate(params.tabletId, tablet.config);

        return reply.status(200).send({
          success: true,
          data: tablet.config,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 10. GET /v1/households/:householdId/display-tablets/:tabletId/config-updates - SSE endpoint for real-time config updates
  fastify.get(
    '/v1/households/:householdId/display-tablets/:tabletId/config-updates',
    {
      preHandler: async (request: any, reply: any) => {
        // This endpoint accepts tablet authentication via:
        // 1. x-tablet-session-token (JWT from /authenticate)
        // 2. x-tablet-id + x-tablet-token (raw credentials)
        
        // Try method 1: JWT session token (already set by global middleware)
        if (request.tabletSession) {
          const params = request.params as any;
          
          // Validate tablet can only subscribe to its own updates
          if (request.tabletSession.tabletId !== params.tabletId) {
            return reply.status(403).send({
              status: 'error',
              message: 'Tablets can only subscribe to their own config updates.',
            });
          }
          
          if (request.tabletSession.householdId !== params.householdId) {
            return reply.status(403).send({
              status: 'error',
              message: 'Tablet does not belong to this household.',
            });
          }
          
          return; // Authenticated via JWT
        }
        
        // Try method 2: Raw credentials (x-tablet-id + x-tablet-token)
        const tabletId = (request.headers['x-tablet-id'] as string | undefined)?.trim();
        const tabletToken = (request.headers['x-tablet-token'] as string | undefined)?.trim();
        
        if (!tabletId || !tabletToken) {
          return reply.status(401).send({
            status: 'error',
            message: 'Tablet authentication required. Provide x-tablet-id + x-tablet-token or x-tablet-session-token.',
          });
        }
        
        // Validate tabletId matches URL
        const params = request.params as any;
        if (tabletId !== params.tabletId) {
          return reply.status(403).send({
            status: 'error',
            message: 'Tablet ID in headers does not match URL.',
          });
        }
        
        // Authenticate with raw credentials
        try {
          const tabletAuth = await repository.authenticateDisplayTablet(tabletId, tabletToken);
          
          if (!tabletAuth) {
            return reply.status(401).send({
              status: 'error',
              message: 'Invalid tablet credentials or tablet is not active.',
            });
          }
          
          // Validate householdId
          if (tabletAuth.householdId !== params.householdId) {
            return reply.status(403).send({
              status: 'error',
              message: 'Tablet does not belong to this household.',
            });
          }
          
          // Set tablet session for use in route handler
          request.tabletSession = {
            tabletId: tabletId,
            householdId: tabletAuth.householdId,
            permissions: tabletAuth.permissions,
            isTablet: true,
          };
          
          return; // Authenticated via raw credentials
        } catch (error) {
          fastify.log.error({ error, tabletId }, 'SSE tablet authentication error');
          return reply.status(500).send({
            status: 'error',
            message: 'Internal server error during authentication.',
          });
        }
      },
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
      },
    },
    async (request, reply) => {
      const params = householdTabletParamsSchema.parse(request.params);

      // Set up SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      });

      // Register the tablet for notifications
      tabletConfigNotifier.registerTablet(params.tabletId, reply);

      // Handle client disconnect
      request.raw.on('close', () => {
        tabletConfigNotifier.unregisterTablet(params.tabletId);
      });

      // Keep the connection open (SSE will be handled by tabletConfigNotifier)
    },
  );
};
