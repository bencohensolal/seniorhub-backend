import type { FastifyInstance } from 'fastify';
import type { CheckMissedMedicationsUseCase } from '../../domain/usecases/notifications/CheckMissedMedicationsUseCase.js';
import type { PostgresNotificationRepository } from '../../data/repositories/postgres/PostgresNotificationRepository.js';

/**
 * Internal routes for manual triggering — useful for testing.
 * These are NOT protected by user auth; call them only from trusted contexts.
 */
export function registerInternalRoutes(
  fastify: FastifyInstance,
  checkMissedUseCase: CheckMissedMedicationsUseCase,
  notifRepo: PostgresNotificationRepository,
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
            force: { type: 'boolean', default: false },
          },
        },
        response: {
          '2xx': {
            type: 'object',
            properties: {
              status: { type: 'string' },
              message: { type: 'string' },
              missedCount: { type: 'integer' },
              alertsSent: { type: 'integer' },
              skippedNoCaregiver: { type: 'integer' },
              skippedNoToken: { type: 'integer' },
            },
          },
          '5xx': {
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
      const query = request.query as { graceMinutes?: number; force?: boolean };
      const graceMinutes = query.graceMinutes ?? 0;
      const force = query.force ?? false;

      try {
        let cleared = 0;
        if (force) {
          cleared = await notifRepo.clearTodayAlerts();
        }
          const result = await checkMissedUseCase.execute(graceMinutes);
        return reply.status(200).send({
          status: 'ok',
          message: `Check completed with graceMinutes=${graceMinutes}${force ? ` (force: cleared ${cleared} alert(s))` : ''}`,
          ...result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        request.log.error({ err }, '[triggerRoutes] checkMissedUseCase failed');
        return reply.status(500).send({ status: 'error', message });
      }
    },
  );
}
