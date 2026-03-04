import type { FastifyInstance } from 'fastify';

const normalize = (value: string | undefined): string => (value && value.trim().length > 0 ? value.trim() : '');

/**
 * Decode a JWT token (simple base64 decode for development)
 * In production, this should use proper JWT verification with a secret key
 */
const decodeJWT = (token: string): any => {
  try {
    // Split the JWT into parts
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }
    
    // Decode the payload (second part)
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    console.error('JWT decode failed:', error);
    return null;
  }
};

/**
 * Unified authentication middleware
 * Supports both Bearer token JWT and x-user-* headers
 */
export const registerAuthContext = (fastify: FastifyInstance): void => {
  fastify.addHook('preHandler', async (request, reply) => {
    // Public endpoints that don't require authentication
    const publicEndpoints = [
      '/health',
      '/v1/medications/autocomplete',
      '/v1/invitations/accept-link',
      '/v1/households/invitations/resolve',
      '/v1/households/invitations/accept',
      '/v1/display-tablets/authenticate', // Tablet authentication endpoint
    ];

    if (publicEndpoints.some(endpoint => request.url.startsWith(endpoint))) {
      return;
    }

    let userContext: {
      userId: string;
      email: string;
      firstName?: string;
      lastName?: string;
    } | null = null;

    // Method 1: Extract from Bearer token
    const authHeader = request.headers.authorization as string | undefined;
    if (authHeader?.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = decodeJWT(token);
        if (decoded) {
          userContext = {
            userId: decoded.sub || decoded.userId || decoded.user_id,
            email: decoded.email,
            firstName: decoded.firstName || decoded.given_name || decoded.first_name,
            lastName: decoded.lastName || decoded.family_name || decoded.last_name,
          };
        }
      } catch (error) {
        console.error('JWT verification failed:', error);
      }
    }

    // Method 2: Fallback to x-user-* headers (if JWT absent or invalid)
    if (!userContext) {
      const userId = normalize(request.headers['x-user-id'] as string | undefined);
      const email = normalize(request.headers['x-user-email'] as string | undefined);
      const firstName = normalize(request.headers['x-user-first-name'] as string | undefined);
      const lastName = normalize(request.headers['x-user-last-name'] as string | undefined);

      if (userId && email) {
        userContext = { userId, email, firstName, lastName };
      }
    }

    // Verify that we have a valid context
    if (!userContext?.userId || !userContext?.email) {
      return reply.status(401).send({
        status: 'error',
        message: 'Authentication required. Provide either Bearer token or x-user-* headers.',
      });
    }

    // Attach context to request
    request.requester = {
      userId: userContext.userId,
      email: userContext.email,
      firstName: userContext.firstName || '',
      lastName: userContext.lastName || '',
    };
  });
};
