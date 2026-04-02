import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../../domain/errors/index.js';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import type { HouseholdPermissionAction } from '../../domain/entities/HouseholdSettings.js';
import { getDefaultHouseholdMemberPermissions } from '../../domain/entities/HouseholdSettings.js';
import type { HouseholdRole } from '../../domain/entities/Member.js';

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

export const ensureHouseholdPermission = async (
  request: FastifyRequest,
  repository: HouseholdRepository,
  householdId: string,
  permission: HouseholdPermissionAction,
): Promise<void> => {
  if (request.tabletSession) {
    throw new ForbiddenError('Tablets do not have permission for this action.');
  }

  const requester = request.requester;
  if (!requester) {
    throw new ForbiddenError('Authentication required.');
  }

  const member = await repository.findActiveMemberByUserInHousehold(
    requester.userId,
    householdId,
  );

  if (!member) {
    throw new ForbiddenError('Access denied to this household.');
  }

  const settings = await repository.getHouseholdSettings(householdId);
  const stored = settings.memberPermissions[member.id];
  const defaults = getDefaultHouseholdMemberPermissions(member.role as HouseholdRole);
  const effectiveValue = stored?.[permission] ?? defaults[permission] ?? false;
  if (!effectiveValue) {
    throw new ForbiddenError(`Missing required household permission: ${permission}.`);
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
