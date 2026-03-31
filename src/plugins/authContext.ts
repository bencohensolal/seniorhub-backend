import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { verifyTabletSessionToken } from '../domain/security/displayTabletSession.js';
import { verifySeniorDeviceSessionToken } from '../domain/security/seniorDeviceSession.js';
import { createHouseholdRepository } from '../data/repositories/createHouseholdRepository.js';

const normalize = (value: string | undefined): string => (value && value.trim().length > 0 ? value.trim() : '');
const getStringClaim = (payload: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
};

const validateActiveTabletSession = async (
  tabletId: string,
  householdId: string,
): Promise<boolean> => {
  const repository = createHouseholdRepository();
  const tablet = await repository.getDisplayTabletById(tabletId, householdId);

  if (!tablet) {
    return false;
  }

  return tablet.status === 'active' && tablet.revokedAt === null;
};

/**
 * Decodes the payload of a JWT without verifying the signature.
 * Signature verification is delegated to the upstream auth provider (BFF/gateway).
 * Returns null if the token is not a valid 3-part JWT.
 */
const decodeJWT = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
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
      '/v1/display-tablets/authenticate', // Tablet setup authentication endpoint
      '/v1/display-tablets/session/refresh',
      '/v1/senior-devices/authenticate', // Senior device pairing endpoint
      '/v1/senior-devices/session/refresh',
      '/v1/auth/email/register',          // Email + password registration
      '/v1/auth/email/login',             // Email + password login
      '/v1/auth/email/session/refresh',   // Email session refresh
      '/internal/', // Internal dev/test routes — no auth required
      '/v1/webhooks/', // Webhooks — auth verified internally by each handler
    ];
    if (publicEndpoints.some(endpoint => request.url.startsWith(endpoint))) {
      return;
    }

    // Try tablet authentication first (Method 1: via session token JWT)
    const tabletSessionToken = normalize(request.headers['x-tablet-session-token'] as string | undefined);

    if (tabletSessionToken) {
      const tabletPayload = verifyTabletSessionToken(tabletSessionToken);

      if (tabletPayload) {
        const isActiveSession = await validateActiveTabletSession(
          tabletPayload.tabletId,
          tabletPayload.householdId,
        );

        if (!isActiveSession) {
          fastify.log.warn({
            tabletId: tabletPayload.tabletId,
            householdId: tabletPayload.householdId,
            path: request.url,
          }, 'Rejected tablet session token for inactive or revoked tablet');

          return reply.status(401).send({
            status: 'error',
            message: 'Tablet session is no longer valid.',
          });
        }

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

    // Try senior device authentication (Method 2: via senior session token)
    const seniorSessionToken = normalize(request.headers['x-senior-session-token'] as string | undefined);

    if (seniorSessionToken) {
      const seniorPayload = verifySeniorDeviceSessionToken(seniorSessionToken);

      if (seniorPayload) {
        const repository = createHouseholdRepository();
        const device = await repository.getSeniorDeviceById(seniorPayload.deviceId, seniorPayload.householdId);

        if (!device || device.status !== 'active' || device.revokedAt !== null) {
          fastify.log.warn({
            deviceId: seniorPayload.deviceId,
            householdId: seniorPayload.householdId,
            path: request.url,
          }, 'Rejected senior device session token for inactive or revoked device');

          return reply.status(401).send({
            status: 'error',
            message: 'Senior device session is no longer valid.',
          });
        }

        // Valid senior device session - set requester context (read+write access)
        request.requester = {
          userId: seniorPayload.userId,
          email: '',
          firstName: '',
          lastName: '',
        };

        fastify.log.info({
          deviceId: seniorPayload.deviceId,
          householdId: seniorPayload.householdId,
          memberId: seniorPayload.memberId,
          path: request.url,
        }, 'Senior device authenticated via session token');

        return;
      } else {
        fastify.log.warn({
          token: seniorSessionToken.substring(0, 20) + '...',
          path: request.url,
        }, 'Invalid senior device session token');

        return reply.status(401).send({
          status: 'error',
          message: 'Invalid or expired senior device session token.',
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
          const firstName = getStringClaim(decoded, 'firstName', 'given_name', 'first_name');
          const lastName = getStringClaim(decoded, 'lastName', 'family_name', 'last_name');
          const userId = getStringClaim(decoded, 'sub', 'userId', 'user_id');
          const email = getStringClaim(decoded, 'email');

          userContext = {
            userId: userId || '',
            email: email || '',
            ...(firstName !== undefined && { firstName }),
            ...(lastName !== undefined && { lastName }),
          };
        }
      } catch {
        // Non-JWT Bearer token — fall through to x-user-* headers
      }
    }

    // Method 2: Fallback to x-user-* headers (if JWT absent or invalid)
    if (!userContext) {
      const userId = normalize(request.headers['x-user-id'] as string | undefined);
      const email = normalize(request.headers['x-user-email'] as string | undefined);
      const firstName = normalize(request.headers['x-user-first-name'] as string | undefined);
      const lastName = normalize(request.headers['x-user-last-name'] as string | undefined);

      if (userId) {
        userContext = { userId, email: email || '', firstName, lastName };
      }
    }

    // Verify that we have a valid user context (email is optional for proxy/device users)
    if (!userContext?.userId) {
      return reply.status(401).send({
        status: 'error',
        message: 'Authentication required. Provide either a Bearer token, x-user-* headers, x-tablet-session-token, or x-senior-session-token.',
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
export const requireWritePermission = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
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
export const requireUserAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  if (!request.requester) {
    return reply.status(401).send({
      status: 'error',
      message: 'This operation requires user authentication.',
    });
  }
};
