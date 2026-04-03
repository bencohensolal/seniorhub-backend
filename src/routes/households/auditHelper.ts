import type { FastifyRequest } from 'fastify';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import type { AuditAction } from '../../domain/entities/AuditEvent.js';
import { getCategoryForAction } from '../../domain/entities/AuditEvent.js';

/**
 * Fire-and-forget audit logger for route handlers.
 * Never throws — audit failures are logged but never block the user request.
 *
 * Usage (one line per action):
 *   logAudit(repository, request, householdId, 'create_appointment', result.id, { title: body.title });
 */
export function logAudit(
  repository: HouseholdRepository,
  request: FastifyRequest,
  householdId: string | null,
  action: AuditAction,
  targetId?: string | null,
  metadata?: Record<string, string>,
): void {
  const actorUserId = (request as any).requester?.userId ?? null;
  repository
    .logAuditEvent({
      householdId,
      actorUserId,
      action,
      category: getCategoryForAction(action),
      targetId: targetId ?? null,
      metadata: metadata ?? {},
    })
    .catch((err) => {
      request.log.error({ err, action, householdId }, 'Failed to log audit event');
    });
}
