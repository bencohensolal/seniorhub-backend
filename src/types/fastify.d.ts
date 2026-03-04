import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    // User session context (when authenticated as a user)
    requester?: {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    // Tablet session context (when authenticated as a tablet)
    tabletSession?: {
      tabletId: string;
      householdId: string;
      permissions: string[];
      isTablet: true;
    };
  }
}
