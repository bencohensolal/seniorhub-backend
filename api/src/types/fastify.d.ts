import type { AuthenticatedRequester } from '../domain/entities/Household.js';

declare module 'fastify' {
  interface FastifyRequest {
    requester: AuthenticatedRequester;
  }
}
