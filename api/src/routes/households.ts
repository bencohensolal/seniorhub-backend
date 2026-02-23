import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { GetHouseholdOverviewUseCase } from '../domain/usecases/GetHouseholdOverviewUseCase.js';
import { InMemoryHouseholdRepository } from '../data/repositories/InMemoryHouseholdRepository.js';

const paramsSchema = z.object({
  householdId: z.string().min(1),
});

const querySchema = z.object({
  requesterMemberId: z.string().min(1),
});

export const householdsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = new InMemoryHouseholdRepository();
  const getHouseholdOverviewUseCase = new GetHouseholdOverviewUseCase(repository);

  fastify.get('/v1/households/:householdId/overview', async (request, reply) => {
    const paramsResult = paramsSchema.safeParse(request.params);
    const queryResult = querySchema.safeParse(request.query);

    if (!paramsResult.success || !queryResult.success) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid request payload.',
      });
    }

    try {
      const overview = await getHouseholdOverviewUseCase.execute({
        householdId: paramsResult.data.householdId,
        requesterMemberId: queryResult.data.requesterMemberId,
      });

      return reply.status(200).send({
        status: 'success',
        data: overview,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      const statusCode = message === 'Access denied to this household.' ? 403 : 404;

      return reply.status(statusCode).send({
        status: 'error',
        message,
      });
    }
  });
};
