import type { FastifyInstance } from 'fastify';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { GetHouseholdSubscriptionUseCase } from '../../../domain/usecases/subscriptions/GetHouseholdSubscriptionUseCase.js';
import type { SubscriptionPlan } from '../../../domain/entities/Subscription.js';
import { handleDomainError } from '../../errorHandler.js';
import { getRequesterContext } from '../utils.js';
import { logAudit } from '../auditHelper.js';

const errorResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
  },
  required: ['status', 'message'],
};

function mapProductToPlan(productId: string): SubscriptionPlan {
  if (productId.startsWith('serenite') || productId.startsWith('serenity')) return 'serenite';
  if (productId.startsWith('famille') || productId.startsWith('family')) return 'famille';
  return 'gratuit';
}

export function registerSubscriptionRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
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

  // POST /v1/households/:householdId/subscription/confirm-purchase
  // Called by the app after a successful RevenueCat purchase to update the plan
  // immediately, without waiting for the webhook (which may not fire in test store).
  fastify.post(
    '/v1/households/:householdId/subscription/confirm-purchase',
    {
      schema: {
        tags: ['Subscriptions'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
          },
          required: ['productId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { householdId } = request.params as { householdId: string };
      const { productId } = request.body as { productId: string };

      try {
        const plan = mapProductToPlan(productId);
        if (plan === 'gratuit') {
          return reply.status(400).send({ status: 'error', message: `Unknown product: ${productId}` });
        }

        const sub = await repository.ensureDefaultSubscription(householdId);
        await repository.updateSubscription(sub.id, {
          plan,
          status: 'active',
          rcProductId: productId,
          cancelAtPeriodEnd: false,
        });

        request.log.info({ householdId, plan, productId }, 'Subscription confirmed via app');

        logAudit(repository, request, householdId, 'confirm_subscription_purchase', sub.id, { plan, productId });

        // Return updated subscription info
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
