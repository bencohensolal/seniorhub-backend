import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HouseholdRepository } from '../domain/repositories/HouseholdRepository.js';
import { requireWritePermission } from '../plugins/authContext.js';

const updateUserProfileBodySchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

const errorResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
  },
  required: ['status', 'message'],
};

export function registerUserProfileRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
): void {
  fastify.get(
    '/v1/users/me/profile',
    {
      schema: {
        tags: ['Users'],
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  email: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['firstName', 'lastName', 'email', 'updatedAt'],
              },
            },
            required: ['data'],
          },
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const requester = request.requester;
      if (!requester) {
        return reply.status(401).send({
          status: 'error',
          message: 'Unauthorized.',
        });
      }

      const profile = await repository.getUserProfile(requester.userId);
      const fallbackUpdatedAt = new Date().toISOString();

      return reply.status(200).send({
        data: profile ? {
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          updatedAt: profile.updatedAt,
        } : {
          firstName: requester.firstName,
          lastName: requester.lastName,
          email: requester.email,
          updatedAt: fallbackUpdatedAt,
        },
      });
    },
  );

  fastify.put(
    '/v1/users/me/profile',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Users'],
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string', minLength: 1, maxLength: 80 },
            lastName: { type: 'string', minLength: 1, maxLength: 80 },
          },
          required: ['firstName', 'lastName'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  email: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
                required: ['firstName', 'lastName', 'email', 'updatedAt'],
              },
            },
            required: ['data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const requester = request.requester;
      if (!requester) {
        return reply.status(401).send({
          status: 'error',
          message: 'Unauthorized.',
        });
      }

      const parsedBody = updateUserProfileBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      const profile = await repository.updateUserProfile(requester.userId, {
        email: requester.email,
        firstName: parsedBody.data.firstName,
        lastName: parsedBody.data.lastName,
      });

      return reply.status(200).send({
        data: {
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          updatedAt: profile.updatedAt,
        },
      });
    },
  );
}
