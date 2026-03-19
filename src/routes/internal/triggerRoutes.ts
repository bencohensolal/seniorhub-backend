import type { FastifyInstance } from 'fastify';
import type { CheckMissedMedicationsUseCase } from '../../domain/usecases/notifications/CheckMissedMedicationsUseCase.js';

/**
 * Internal routes for manual triggering — useful for testing.
 * These are NOT protected by user auth; call them only from trusted contexts.
 */
export function registerInternalRoutes(
  fastify: FastifyInstance,
  checkMissedUseCase: CheckMissedMedicationsUseCase,
): void {
  fastify.post(
    '/internal/trigger-missed-medication-check',
    {
      schema: {
        tags: ['Internal'],
        querystring: {
          type: 'object',
          properties: {
            graceMinutes: { type: 'integer', minimum: 0, default: 0 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as { graceMinutes?: number };
      const graceMinutes = query.graceMinutes ?? 0;

      await checkMissedUseCase.execute(graceMinutes);

      return reply.status(200).send({
        status: 'ok',
        message: `Check completed with graceMinutes=${graceMinutes}`,
      });
    },
  );
}
