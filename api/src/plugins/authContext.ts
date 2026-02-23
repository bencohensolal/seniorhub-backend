import type { FastifyPluginAsync } from 'fastify';

const normalize = (value: string | undefined): string => (value && value.trim().length > 0 ? value.trim() : '');

export const authContextPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health') {
      return;
    }

    const userId = normalize(request.headers['x-user-id'] as string | undefined);
    const email = normalize(request.headers['x-user-email'] as string | undefined);
    const firstName = normalize(request.headers['x-user-first-name'] as string | undefined);
    const lastName = normalize(request.headers['x-user-last-name'] as string | undefined);

    if (!userId || !email || !firstName || !lastName) {
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
