import type { FastifyRequest, FastifyReply } from 'fastify';

// ============================================
// Tablet Authentication Utilities
// ============================================

/**
 * Extract requester context from either user or tablet session
 * For use-cases that need user info (e.g., for audit trails)
 */
export const getRequesterContext = (request: FastifyRequest): {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
} => {
  if (request.requester) {
    return request.requester;
  }
  
  // Tablets don't have user context, return system user
  if (request.tabletSession) {
    return {
      userId: `tablet:${request.tabletSession.tabletId}`,
      email: 'tablet@system',
      firstName: 'Display',
      lastName: 'Tablet',
    };
  }
  
  throw new Error('No authentication context found');
};

/**
 * Get the household ID from either user or tablet context
 * For tablets, this comes from the session
 * For users, this comes from the route params
 */
export const getAuthenticatedHouseholdId = (request: FastifyRequest): string | null => {
  if (request.tabletSession) {
    return request.tabletSession.householdId;
  }
  return null;
};

/**
 * Verify that a tablet is accessing its own household
 * Throws 403 error if tablet tries to access another household
 */
export const verifyTabletHouseholdAccess = (
  request: FastifyRequest,
  reply: FastifyReply,
  householdId: string,
): void => {
  if (request.tabletSession) {
    if (request.tabletSession.householdId !== householdId) {
      reply.status(403).send({
        status: 'error',
        message: 'Access denied. Tablets can only access their own household data.',
      });
      throw new Error('Tablet household access denied');
    }
  }
};

/**
 * Check if the current request is from a tablet
 */
export const isTabletRequest = (request: FastifyRequest): boolean => {
  return !!request.tabletSession;
};

/**
 * Check if the current request is from a user
 */
export const isUserRequest = (request: FastifyRequest): boolean => {
  return !!request.requester && !request.tabletSession;
};

// ============================================
// Invitation Utilities (Legacy)
// ============================================

// Utility functions for invitation rate limiting
const inviteRateState = new Map<string, { count: number; windowStartMs: number }>();
const INVITE_RATE_LIMIT = 10;
const INVITE_WINDOW_MS = 60_000;

export const checkInviteRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const current = inviteRateState.get(userId);
  if (!current) {
    inviteRateState.set(userId, { count: 1, windowStartMs: now });
    return true;
  }

  if (now - current.windowStartMs > INVITE_WINDOW_MS) {
    inviteRateState.set(userId, { count: 1, windowStartMs: now });
    return true;
  }

  if (current.count >= INVITE_RATE_LIMIT) {
    return false;
  }

  current.count += 1;
  return true;
};

// Email masking utility
export const maskEmail = (email: string): string => email.replace(/(^.).+(@.+$)/, '$1***$2');

// Invitation sanitization for responses
export const sanitizeInvitation = (invitation: {
  id: string;
  householdId: string;
  inviteeFirstName: string;
  inviteeLastName: string;
  inviteeEmail: string;
  assignedRole: string;
  status: string;
  tokenExpiresAt: string;
  createdAt: string;
}) => ({
  id: invitation.id,
  householdId: invitation.householdId,
  inviteeFirstName: invitation.inviteeFirstName,
  inviteeLastName: invitation.inviteeLastName,
  inviteeEmailMasked: maskEmail(invitation.inviteeEmail),
  assignedRole: invitation.assignedRole,
  status: invitation.status,
  tokenExpiresAt: invitation.tokenExpiresAt,
  createdAt: invitation.createdAt,
});
