import type { FastifyInstance } from 'fastify';
import type { PostgresNotificationRepository } from '../../data/repositories/postgres/PostgresNotificationRepository.js';

/**
 * Internal routes for manual triggering — useful for testing.
 * These are NOT protected by user auth; call them only from trusted contexts.
 */
export function registerInternalRoutes(
  fastify: FastifyInstance,
  notifRepo: PostgresNotificationRepository,
): void {
  // Placeholder for future internal trigger routes
}
