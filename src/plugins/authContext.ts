import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { verifyTabletSessionToken } from '../domain/security/displayTabletSession.js';
import type { HouseholdRepository } from '../domain/repositories/HouseholdRepository.js';
import { createHouseholdRepository } from '../data/repositories/createHouseholdRepository.js';

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
 * Supports:
 * 1. User authentication via Bearer token JWT or x-user-* headers
 * 2. Tablet authentication via x-tablet-session-token
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

    // Try tablet authentication first (Method 1: via session token JWT)
    const tabletSessionToken = normalize(request.headers['x-tablet-session-token'] as string | undefined);
    
    if (tabletSessionToken) {
      const tabletPayload = verifyTabletSessionToken(tabletSessionToken);
      
      if (tabletPayload) {
        // Valid tablet session - set tablet context
        request.tabletSession = {
          tabletId: tabletPayload.tabletId,
          householdId: tabletPayload.householdId,
          permissions: tabletPayload.permissions,
          isTablet: true,
        };
        
        fastify.log.info({ 
          tabletId: tabletPayload.tabletId,
          householdId: tabletPayload.householdId,
          path: request.url 
        }, 'Tablet authenticated via session token');
        
        return; // Tablet is authenticated
      } else {
        // Invalid tablet token
        fastify.log.warn({ 
          token: tabletSessionToken.substring(0, 20) + '...',
          path: request.url 
        }, 'Invalid tablet session token');
        
        return reply.status(401).send({
          status: 'error',
          message: 'Invalid or expired tablet session token.',
        });
      }
    }

    // Try tablet authentication (Method 2: via x-tablet-id + x-tablet-token)
    const tabletId = normalize(request.headers['x-tablet-id'] as string | undefined);
    let tabletToken = normalize(request.headers['x-tablet-token'] as string | undefined);
    
    // Also check Authorization header for tablet token
    if (!tabletToken && tabletId) {
      const authHeader = request.headers.authorization as string | undefined;
      if (authHeader?.toLowerCase().startsWith('bearer ')) {
        tabletToken = authHeader.substring(7).trim();
      }
    }
    
    if (tabletId && tabletToken) {
      try {
        // Get repository
        const repository = createHouseholdRepository();
        
        // Authenticate tablet with raw token (will be hashed in repository)
        const tabletAuth = await repository.authenticateDisplayTablet(tabletId, tabletToken);
        
        if (tabletAuth) {
          // Valid tablet - set tablet context
          request.tabletSession = {
            tabletId: tabletId, // Use the tabletId from headers
            householdId: tabletAuth.householdId,
            permissions: tabletAuth.permissions,
            isTablet: true,
          };
          
          fastify.log.info({ 
            tabletId: tabletId,
            householdId: tabletAuth.householdId,
            path: request.url 
          }, 'Tablet authenticated via x-tablet-id + x-tablet-token');
          
          return; // Tablet is authenticated
        } else {
          // Invalid tablet credentials
          fastify.log.warn({ 
            tabletId,
            path: request.url 
          }, 'Invalid tablet credentials');
          
          return reply.status(401).send({
            status: 'error',
            message: 'Invalid tablet credentials or tablet is not active.',
          });
        }
      } catch (error) {
        fastify.log.error({ error, tabletId }, 'Tablet authentication error');
        return reply.status(500).send({
          status: 'error',
          message: 'Internal server error during tablet authentication.',
        });
      }
    }

    // Fall back to user authentication
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

    // Verify that we have a valid user context
    if (!userContext?.userId || !userContext?.email) {
      return reply.status(401).send({
        status: 'error',
        message: 'Authentication required. Provide either Bearer token, x-user-* headers, or x-tablet-session-token.',
      });
    }

    // Attach user context to request
    request.requester = {
      userId: userContext.userId,
      email: userContext.email,
      firstName: userContext.firstName || '',
      lastName: userContext.lastName || '',
    };
  });
};

/**
 * Middleware to require write permission
 * This will block tablet sessions from write operations
 */
export const requireWritePermission = async (request: any, reply: any): Promise<void> => {
  // If this is a tablet session, deny write access
  if (request.tabletSession) {
    return reply.status(403).send({
      status: 'error',
      message: 'Tablets have read-only access. Write operations are not permitted.',
    });
  }
  
  // User sessions have write permission by default
  if (!request.requester) {
    return reply.status(401).send({
      status: 'error',
      message: 'Authentication required.',
    });
  }
};

/**
 * Middleware to require user authentication (blocks tablets)
 * Use this for routes that should only be accessible to authenticated users, not tablets
 */
export const requireUserAuth = async (request: any, reply: any): Promise<void> => {
  if (!request.requester) {
    return reply.status(401).send({
      status: 'error',
      message: 'This operation requires user authentication.',
    });
  }
};
