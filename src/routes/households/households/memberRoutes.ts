import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import type { ListHouseholdMembersUseCase } from '../../../domain/usecases/households/ListHouseholdMembersUseCase.js';
import type { RemoveHouseholdMemberUseCase } from '../../../domain/usecases/households/RemoveHouseholdMemberUseCase.js';
import type { UpdateHouseholdMemberRoleUseCase } from '../../../domain/usecases/households/UpdateHouseholdMemberRoleUseCase.js';
import type { LeaveHouseholdUseCase } from '../../../domain/usecases/households/LeaveHouseholdUseCase.js';
import { paramsSchema, errorResponseSchema } from '../householdSchemas.js';
import { handleDomainError } from '../../errorHandler.js';
import { ensureHouseholdPermission, getRequesterContext } from '../utils.js';
import { buildHouseholdPrivacyContext, filterMembersByPrivacy } from '../../../domain/services/privacyFilter.js';
import { requireWritePermission } from '../../../plugins/authContext.js';

export function registerMemberRoutes(
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  useCases: {
    listHouseholdMembersUseCase: ListHouseholdMembersUseCase;
    removeHouseholdMemberUseCase: RemoveHouseholdMemberUseCase;
    updateHouseholdMemberRoleUseCase: UpdateHouseholdMemberRoleUseCase;
    leaveHouseholdUseCase: LeaveHouseholdUseCase;
  },
): void {
  // GET /v1/households/:householdId/members - List household members (users + tablets allowed)
  fastify.get(
    '/v1/households/:householdId/members',
    {
      preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
        if (!request.requester && !request.tabletSession) {
          return reply.status(401).send({
            status: 'error',
            message: 'Authentication required. Provide user credentials or tablet session.',
          });
        }

        if (request.tabletSession) {
          const params = paramsSchema.parse(request.params);
          if (request.tabletSession.householdId !== params.householdId) {
            return reply.status(403).send({
              status: 'error',
              message: 'Tablets can only access their own household members.',
            });
          }
        }
      },
      schema: {
        tags: ['Households'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    role: { type: 'string', enum: ['senior', 'caregiver'] },
                    joinedAt: { type: 'string' },
                  },
                  required: ['id', 'firstName', 'lastName', 'role', 'joinedAt'],
                },
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        const errorMessage = paramsResult.error.issues[0]?.message || 'Invalid household ID format';
        fastify.log.warn({
          error: paramsResult.error,
          params: request.params,
        }, `[GET /members] Validation failed: ${errorMessage}`);
        return reply.status(400).send({ status: 'error', message: errorMessage });
      }

      try {
        const members = await useCases.listHouseholdMembersUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: getRequesterContext(request),
        });
        const privacyContext = await buildHouseholdPrivacyContext(repository, paramsResult.data.householdId);
        const filteredMembers = filterMembersByPrivacy(members, privacyContext, request.requester?.userId);

        return reply.status(200).send({
          status: 'success',
          data: filteredMembers.map((member) => ({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            role: member.role,
            joinedAt: member.joinedAt,
          })),
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/members/me - Leave a household
  fastify.delete(
    '/v1/households/:householdId/members/me',
    {
      schema: {
        tags: ['Households'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              message: { type: 'string' },
            },
            required: ['status', 'message'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { householdId: string };

      try {
        await useCases.leaveHouseholdUseCase.execute({
          householdId: params.householdId,
          requester: getRequesterContext(request),
        });

        return reply.status(200).send({ status: 'success', message: 'Successfully left the household.' });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // DELETE /v1/households/:householdId/members/:memberId - Remove a household member
  fastify.delete(
    '/v1/households/:householdId/members/:memberId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Households'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            memberId: { type: 'string' },
          },
          required: ['householdId', 'memberId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              message: { type: 'string' },
            },
            required: ['status', 'message'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { householdId: string; memberId: string };

      try {
        await ensureHouseholdPermission(request, repository, params.householdId, 'archiveMembers');
        await useCases.removeHouseholdMemberUseCase.execute({
          householdId: params.householdId,
          memberId: params.memberId,
          requester: getRequesterContext(request),
        });

        return reply.status(200).send({ status: 'success', message: 'Member removed successfully.' });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // PATCH /v1/households/:householdId/members/:memberId - Update member role
  fastify.patch(
    '/v1/households/:householdId/members/:memberId',
    {
      preHandler: requireWritePermission,
      schema: {
        tags: ['Households'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            memberId: { type: 'string' },
          },
          required: ['householdId', 'memberId'],
        },
        body: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['senior', 'caregiver'] },
          },
          required: ['role'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  householdId: { type: 'string' },
                  role: { type: 'string', enum: ['senior', 'caregiver'] },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  joinedAt: { type: 'string' },
                  status: { type: 'string' },
                },
                required: ['id', 'userId', 'householdId', 'role', 'firstName', 'lastName', 'joinedAt', 'status'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { householdId: string; memberId: string };
      const body = request.body as { role: 'senior' | 'caregiver' };

      try {
        await ensureHouseholdPermission(request, repository, params.householdId, 'editMemberRoles');
        const updatedMember = await useCases.updateHouseholdMemberRoleUseCase.execute({
          householdId: params.householdId,
          memberId: params.memberId,
          newRole: body.role,
          requester: getRequesterContext(request),
        });
        const privacyContext = await buildHouseholdPrivacyContext(repository, params.householdId);
        const [filteredMember] = filterMembersByPrivacy([updatedMember], privacyContext, request.requester?.userId);

        return reply.status(200).send({ status: 'success', data: filteredMember });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
}
