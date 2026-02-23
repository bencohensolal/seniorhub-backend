import type { FastifyPluginAsync } from 'fastify';

const normalize = (value: string | undefined, fallback: string): string =>
  value && value.trim().length > 0 ? value.trim() : fallback;

export const authContextPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const userId = normalize(request.headers['x-user-id'] as string | undefined, 'user-2');
    const email = normalize(request.headers['x-user-email'] as string | undefined, 'ben@example.com');
    const firstName = normalize(request.headers['x-user-first-name'] as string | undefined, 'Ben');
    const lastName = normalize(request.headers['x-user-last-name'] as string | undefined, 'Martin');

    if (!userId || !email) {
      return reply.status(401).send({
        status: 'error',
        message: 'Authentication context is missing.',
      });
    }

    request.requester = {
      userId,
      email,
      firstName,
      lastName,
    };
  });
};
