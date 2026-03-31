import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UpdatePrivacySettingsInput } from '../domain/entities/PrivacySettings.js';
import type { GetUserPrivacySettingsUseCase } from '../domain/usecases/privacySettings/GetUserPrivacySettingsUseCase.js';
import type { UpdateUserPrivacySettingsUseCase } from '../domain/usecases/privacySettings/UpdateUserPrivacySettingsUseCase.js';
import { handleDomainError } from './errorHandler.js';
import { requireWritePermission } from '../plugins/authContext.js';

const updatePrivacySettingsBodySchema = z.object({
  shareProfile: z.boolean().optional(),
  shareActivityHistory: z.boolean().optional(),
  allowAnalytics: z.boolean().optional(),
});

const errorResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
  },
  required: ['status', 'message'],
};

export function registerPrivacySettingsRoutes(
  fastify: FastifyInstance,
  useCases: {
    getUserPrivacySettingsUseCase: GetUserPrivacySettingsUseCase;
    updateUserPrivacySettingsUseCase: UpdateUserPrivacySettingsUseCase;
  },
): void {
  // GET /v1/users/me/privacy-settings
  fastify.get(
    '/v1/users/me/privacy-settings',
    {
      schema: {
        tags: ['Privacy'],
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  shareProfile: { type: 'boolean' },
                  shareActivityHistory: { type: 'boolean' },
                  allowAnalytics: { type: 'boolean' },
                },
                required: ['shareProfile', 'shareActivityHistory', 'allowAnalytics'],
              },
            },
            required: ['data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.headers['x-user-id'] as string;

        if (!userId) {
          return reply.status(401).send({
            status: 'error',
            message: 'Unauthorized.',
          });
        }

        const settings = await useCases.getUserPrivacySettingsUseCase.execute({ userId });

        return reply.status(200).send({
          data: {
            shareProfile: settings.shareProfile,
            shareActivityHistory: settings.shareActivityHistory,
            allowAnalytics: settings.allowAnalytics,
          },
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PUT /v1/users/me/privacy-settings
  fastify.put(
    '/v1/users/me/privacy-settings',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Privacy'],
        body: {
          type: 'object',
          properties: {
            shareProfile: { type: 'boolean' },
            shareActivityHistory: { type: 'boolean' },
            allowAnalytics: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  shareProfile: { type: 'boolean' },
                  shareActivityHistory: { type: 'boolean' },
                  allowAnalytics: { type: 'boolean' },
                  updatedAt: { type: 'string' },
                },
                required: ['shareProfile', 'shareActivityHistory', 'allowAnalytics', 'updatedAt'],
              },
            },
            required: ['data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const userId = request.headers['x-user-id'] as string;

        if (!userId) {
          return reply.status(401).send({
            status: 'error',
            message: 'Unauthorized.',
          });
        }

        const bodyResult = updatePrivacySettingsBodySchema.safeParse(request.body);

        if (!bodyResult.success) {
          return reply.status(400).send({
            status: 'error',
            message: 'Invalid request payload.',
          });
        }

        const settings = await useCases.updateUserPrivacySettingsUseCase.execute({
          userId,
          settings: bodyResult.data as UpdatePrivacySettingsInput,
        });

        return reply.status(200).send({
          data: {
            shareProfile: settings.shareProfile,
            shareActivityHistory: settings.shareActivityHistory,
            allowAnalytics: settings.allowAnalytics,
            updatedAt: settings.updatedAt,
          },
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
