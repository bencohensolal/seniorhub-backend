import type { FastifyInstance } from 'fastify';

const normalize = (value: string | undefined): string => (value && value.trim().length > 0 ? value.trim() : '');

export const registerAuthContext = (fastify: FastifyInstance): void => {
  fastify.addHook('preHandler', async (request, reply) => {
    // Public endpoints that don't require authentication
    const publicEndpoints = [
      '/health',
      '/v1/medications/autocomplete',
    ];

    if (publicEndpoints.some(endpoint => request.url.startsWith(endpoint))) {
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
