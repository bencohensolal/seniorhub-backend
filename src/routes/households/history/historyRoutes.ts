import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { GetHouseholdSubscriptionUseCase } from '../../../domain/usecases/subscriptions/GetHouseholdSubscriptionUseCase.js';
import { paramsSchema } from '../householdSchemas.js';
import { getRequesterContext } from '../utils.js';
import { handleDomainError } from '../../errorHandler.js';
import type { AuditCategory, ListAuditEventsParams } from '../../../domain/entities/AuditEvent.js';

const UNLIMITED = Number.MAX_SAFE_INTEGER;

const querySchema = z.object({
  category: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export function registerHistoryRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  deps: {
    getHouseholdSubscriptionUseCase: GetHouseholdSubscriptionUseCase;
  },
): void {
  // GET /v1/households/:householdId/history
  fastify.get(
    '/v1/households/:householdId/history',
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const queryResult = querySchema.safeParse(request.query);

      if (!paramsResult.success || !queryResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request.' });
      }

      const { householdId } = paramsResult.data;
      const { category, cursor, limit } = queryResult.data;
      const requester = getRequesterContext(request);

      try {
        // Get subscription to enforce historyDays limit
        const subInfo = await deps.getHouseholdSubscriptionUseCase.execute({
          householdId,
          requesterUserId: requester.userId,
        });

        const historyDays = subInfo.limits.historyDays;
        let sinceDate: string | undefined;
        if (historyDays < UNLIMITED) {
          const d = new Date();
          d.setDate(d.getDate() - historyDays);
          sinceDate = d.toISOString();
        }

        const params: ListAuditEventsParams = { householdId, limit };
        if (category) params.category = category as AuditCategory;
        if (cursor) params.cursor = cursor;
        if (sinceDate) params.sinceDate = sinceDate;

        const result = await repository.listAuditEvents(params);

        return reply.send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
