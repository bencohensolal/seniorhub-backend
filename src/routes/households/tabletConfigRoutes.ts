import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import { GetTabletConfigUseCase } from '../../domain/usecases/displayTablets/GetTabletConfigUseCase.js';
import { handleDomainError } from '../errorHandler.js';
import { requireUserAuth } from '../../plugins/authContext.js';
import { tabletDisplayConfigSchema, validateScreenSettings } from './displayTabletSchemas.js';
import { ValidationError } from '../../domain/errors/index.js';
import { tabletConfigNotifier } from '../../domain/services/tabletConfigNotifier.js';

const householdTabletParamsSchema = z.object({
  householdId: z.string().uuid(),
  tabletId: z.string().uuid(),
});

export function registerTabletConfigRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
): void {
  // GET /v1/households/:householdId/display-tablets/:tabletId/config - Get tablet configuration
  fastify.get(
    '/v1/households/:householdId/display-tablets/:tabletId/config',
    {
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const params = householdTabletParamsSchema.parse(request.params);
        if (request.tabletSession) {
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
          return;
        }

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
      },
    },
    async (request, reply) => {
      try {
        const params = householdTabletParamsSchema.parse(request.params);
        const useCase = new GetTabletConfigUseCase(repository);
        const config = await useCase.execute({
          householdId: params.householdId,
          tabletId: params.tabletId,
        });

        return reply.status(200).send({
          success: true,
          data: config,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PUT /v1/households/:householdId/display-tablets/:tabletId/config - Update tablet configuration
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
            kioskModeEnabled: { type: 'boolean' },
            language: { type: 'string', enum: ['en', 'fr'] },
            tapToAdvanceEnabled: { type: 'boolean' },
            showCountdownEnabled: { type: 'boolean' },
            screens: { type: 'array' },
          },
          required: ['slideDuration', 'dataCacheDuration', 'dataRefreshInterval', 'kioskModeEnabled', 'language', 'tapToAdvanceEnabled', 'showCountdownEnabled', 'screens'],
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
        const configData = tabletDisplayConfigSchema.parse(request.body);

        for (const screen of configData.screens) {
          if (!validateScreenSettings(screen)) {
            throw new ValidationError(`Invalid settings for screen type: ${screen.type}`);
          }
        }

        const configWithTimestamp = {
          ...configData,
          lastUpdated: new Date().toISOString(),
        };

        const tablet = await repository.updateDisplayTabletConfig(
          params.tabletId,
          params.householdId,
          configWithTimestamp,
        );

        if (tablet.config) {
          tabletConfigNotifier.notifyConfigUpdate(params.tabletId, tablet.config);
        }

        return reply.status(200).send({
          success: true,
          data: tablet.config,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // GET /v1/households/:householdId/display-tablets/:tabletId/config-updates - SSE endpoint for real-time config updates
  fastify.get(
    '/v1/households/:householdId/display-tablets/:tabletId/config-updates',
    {
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        const params = householdTabletParamsSchema.parse(request.params);

        if (request.tabletSession) {
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

          return;
        }

        return reply.status(401).send({
          status: 'error',
          message: 'Tablet authentication required. Provide x-tablet-session-token.',
        });
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

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      tabletConfigNotifier.registerTablet(params.tabletId, reply);

      request.raw.on('close', () => {
        tabletConfigNotifier.unregisterTablet(params.tabletId);
      });
    },
  );
}
