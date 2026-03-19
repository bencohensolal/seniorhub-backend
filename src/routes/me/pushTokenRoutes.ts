import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PostgresNotificationRepository } from '../../data/repositories/postgres/PostgresNotificationRepository.js';

const bodySchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(['ios', 'android']).optional(),
});

export function registerPushTokenRoutes(
  fastify: FastifyInstance,
  notifRepo: PostgresNotificationRepository,
): void {
  fastify.post(
    '/v1/me/push-token',
    {
      schema: {
        tags: ['Users'],
        body: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            platform: { type: 'string', enum: ['ios', 'android'] },
          },
          required: ['token'],
        },
        response: {
          204: { type: 'null' },
          400: {
            type: 'object',
            properties: { status: { type: 'string' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { status: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const requester = request.requester;
      if (!requester) {
        return reply.status(401).send({ status: 'error', message: 'Unauthorized.' });
      }

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid token.' });
      }

      await notifRepo.upsertPushToken(requester.userId, parsed.data.token, parsed.data.platform);
      return reply.status(204).send();
    },
  );
}
