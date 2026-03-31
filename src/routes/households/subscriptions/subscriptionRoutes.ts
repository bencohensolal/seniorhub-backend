import type { FastifyInstance } from 'fastify';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { GetHouseholdSubscriptionUseCase } from '../../../domain/usecases/subscriptions/GetHouseholdSubscriptionUseCase.js';
import { handleDomainError } from '../../errorHandler.js';
import { getRequesterContext } from '../utils.js';

const errorResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
  },
  required: ['status', 'message'],
};

export function registerSubscriptionRoutes(
  fastify: FastifyInstance,
  _repository: HouseholdRepository,
  useCases: {
    getHouseholdSubscriptionUseCase: GetHouseholdSubscriptionUseCase;
  },
): void {
  // GET /v1/households/:householdId/subscription — Get current subscription & plan limits
  fastify.get(
    '/v1/households/:householdId/subscription',
    {
      schema: {
        tags: ['Subscriptions'],
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
              data: { type: 'object', additionalProperties: true },
            },
            required: ['status', 'data'],
          },
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { householdId } = request.params as { householdId: string };
      try {
        const requester = getRequesterContext(request);
        const result = await useCases.getHouseholdSubscriptionUseCase.execute({
          householdId,
          requesterUserId: requester.userId,
        });
        return reply.status(200).send({ status: 'success', data: result });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
