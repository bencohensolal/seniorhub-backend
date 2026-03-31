import type { FastifyInstance } from 'fastify';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { GetHouseholdSubscriptionUseCase } from '../../../domain/usecases/subscriptions/GetHouseholdSubscriptionUseCase.js';
import type { CreateCheckoutSessionUseCase } from '../../../domain/usecases/subscriptions/CreateCheckoutSessionUseCase.js';
import type { CreatePortalSessionUseCase } from '../../../domain/usecases/subscriptions/CreatePortalSessionUseCase.js';
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
    createCheckoutSessionUseCase: CreateCheckoutSessionUseCase;
    createPortalSessionUseCase: CreatePortalSessionUseCase;
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
              data: { type: 'object' },
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

  // POST /v1/households/:householdId/subscription/checkout — Create Stripe Checkout session
  fastify.post(
    '/v1/households/:householdId/subscription/checkout',
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
            plan: { type: 'string', enum: ['famille', 'serenite'] },
            billingPeriod: { type: 'string', enum: ['monthly', 'yearly'] },
          },
          required: ['plan', 'billingPeriod'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  checkoutUrl: { type: 'string' },
                },
              },
            },
          },
          403: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { householdId } = request.params as { householdId: string };
      const { plan, billingPeriod } = request.body as { plan: 'famille' | 'serenite'; billingPeriod: 'monthly' | 'yearly' };

      try {
        const requester = getRequesterContext(request);
        const result = await useCases.createCheckoutSessionUseCase.execute({
          householdId,
          plan,
          billingPeriod,
          requesterUserId: requester.userId,
        });
        return reply.status(200).send({ status: 'success', data: result });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // POST /v1/households/:householdId/subscription/portal — Redirect to Stripe Customer Portal
  fastify.post(
    '/v1/households/:householdId/subscription/portal',
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
              data: {
                type: 'object',
                properties: {
                  portalUrl: { type: 'string' },
                },
              },
            },
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
        const result = await useCases.createPortalSessionUseCase.execute({
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
