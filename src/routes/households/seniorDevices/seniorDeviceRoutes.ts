import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { HouseholdRepository } from '../../../domain/repositories/HouseholdRepository.js';
import { CreateProxyMemberUseCase } from '../../../domain/usecases/households/CreateProxyMemberUseCase.js';
import { CreateSeniorDeviceUseCase } from '../../../domain/usecases/seniorDevices/CreateSeniorDeviceUseCase.js';
import { AuthenticateSeniorDeviceUseCase } from '../../../domain/usecases/seniorDevices/AuthenticateSeniorDeviceUseCase.js';
import { RefreshSeniorDeviceSessionUseCase } from '../../../domain/usecases/seniorDevices/RefreshSeniorDeviceSessionUseCase.js';
import { RevokeSeniorDeviceUseCase } from '../../../domain/usecases/seniorDevices/RevokeSeniorDeviceUseCase.js';
import { ArchiveMemberUseCase } from '../../../domain/usecases/seniorDevices/ArchiveSeniorUseCase.js';
import { RestoreMemberUseCase } from '../../../domain/usecases/households/RestoreMemberUseCase.js';
import { handleDomainError } from '../../errorHandler.js';
import { requireUserAuth } from '../../../plugins/authContext.js';
import { ensureHouseholdPermission } from '../utils.js';
import { logAudit } from '../auditHelper.js';

// Rate limiting (in-memory, per IP/deviceId)
const deviceAuthRateState = new Map<string, { count: number; windowStartMs: number }>();
const DEVICE_AUTH_RATE_LIMIT = 8;
const DEVICE_AUTH_WINDOW_MS = 5 * 60_000;

const checkDeviceAuthRateLimit = (key: string): boolean => {
  const now = Date.now();
  const current = deviceAuthRateState.get(key);
  if (!current) {
    deviceAuthRateState.set(key, { count: 1, windowStartMs: now });
    return true;
  }
  if (now - current.windowStartMs > DEVICE_AUTH_WINDOW_MS) {
    deviceAuthRateState.set(key, { count: 1, windowStartMs: now });
    return true;
  }
  if (current.count >= DEVICE_AUTH_RATE_LIMIT) {
    return false;
  }
  current.count += 1;
  return true;
};

// Schemas
const householdParamsSchema = z.object({
  householdId: z.string().uuid(),
});

const createProxyMemberBodySchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  role: z.enum(['senior', 'caregiver', 'family', 'intervenant']).default('senior'),
  phoneNumber: z.string().max(20).optional(),
});

const createDeviceBodySchema = z.object({
  memberId: z.string().uuid(),
  name: z.string().min(1).max(255),
});

const authenticateDeviceBodySchema = z.object({
  deviceId: z.string().uuid(),
  setupToken: z.string().length(64),
});

const refreshDeviceSessionBodySchema = z.object({
  deviceId: z.string().uuid(),
  refreshToken: z.string().length(64),
});

const revokeDeviceParamsSchema = z.object({
  householdId: z.string().uuid(),
  deviceId: z.string().uuid(),
});

const archiveMemberParamsSchema = z.object({
  householdId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export const registerSeniorDeviceRoutes = (
  fastify: FastifyInstance,
  repository: HouseholdRepository,
) => {
  // 1. POST /v1/households/:householdId/members/proxy - Create a proxy member (no email required)
  fastify.post(
    '/v1/households/:householdId/members/proxy',
    {
      preHandler: requireUserAuth,
      schema: {
        tags: ['Senior Devices'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          properties: {
            firstName: { type: 'string', minLength: 1, maxLength: 255 },
            lastName: { type: 'string', minLength: 1, maxLength: 255 },
            role: { type: 'string', enum: ['senior', 'caregiver', 'family', 'intervenant'] },
            phoneNumber: { type: 'string', maxLength: 20 },
          },
          required: ['firstName', 'lastName'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  memberId: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = householdParamsSchema.parse(request.params);
        const body = createProxyMemberBodySchema.parse(request.body);
        const useCase = new CreateProxyMemberUseCase(repository);

        const result = await useCase.execute({
          householdId: params.householdId,
          firstName: body.firstName,
          lastName: body.lastName,
          role: body.role,
          ...(body.phoneNumber !== undefined && { phoneNumber: body.phoneNumber }),
          requesterUserId: request.requester!.userId,
        });

        return reply.status(201).send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 2. POST /v1/households/:householdId/senior-devices - Create a senior device
  fastify.post(
    '/v1/households/:householdId/senior-devices',
    {
      preHandler: requireUserAuth,
      schema: {
        tags: ['Senior Devices'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          properties: {
            memberId: { type: 'string' },
            name: { type: 'string', minLength: 1, maxLength: 255 },
          },
          required: ['memberId', 'name'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  householdId: { type: 'string' },
                  memberId: { type: 'string' },
                  name: { type: 'string' },
                  token: { type: 'string' },
                  status: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = householdParamsSchema.parse(request.params);
        const body = createDeviceBodySchema.parse(request.body);
        const useCase = new CreateSeniorDeviceUseCase(repository);

        const device = await useCase.execute({
          householdId: params.householdId,
          memberId: body.memberId,
          name: body.name,
          requesterUserId: request.requester!.userId,
        });

        logAudit(repository, request, params.householdId, 'create_senior_device', device.id, { name: body.name });

        return reply.status(201).send({
          status: 'success',
          data: device,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 3. POST /v1/senior-devices/authenticate - Authenticate a senior device (NO AUTH REQUIRED)
  fastify.post(
    '/v1/senior-devices/authenticate',
    {
      schema: {
        tags: ['Senior Devices'],
        body: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
            setupToken: { type: 'string', minLength: 64, maxLength: 64 },
          },
          required: ['deviceId', 'setupToken'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  householdId: { type: 'string' },
                  householdName: { type: 'string' },
                  memberId: { type: 'string' },
                  userId: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  role: { type: 'string' },
                  permissions: { type: 'array', items: { type: 'string' } },
                  sessionToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: async () => undefined,
    },
    async (request, reply) => {
      try {
        const body = authenticateDeviceBodySchema.parse(request.body);
        const rateLimitKey = `${request.ip}:${body.deviceId}`;

        if (!checkDeviceAuthRateLimit(rateLimitKey)) {
          fastify.log.warn({ deviceId: body.deviceId, ip: request.ip }, 'Senior device authentication rate limit reached');
          return (reply as FastifyReply).status(429).send({
            status: 'error',
            message: 'Device authentication rate limit reached. Please try again later.',
          });
        }

        const useCase = new AuthenticateSeniorDeviceUseCase(repository);

        const result = await useCase.execute({
          deviceId: body.deviceId,
          setupToken: body.setupToken,
        });

        fastify.log.info({
          deviceId: body.deviceId,
          householdId: result.householdId,
          memberId: result.memberId,
          ip: request.ip,
        }, 'Senior device authenticated successfully');

        return reply.status(200).send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 4. POST /v1/senior-devices/session/refresh - Refresh a senior device session (NO AUTH REQUIRED)
  fastify.post(
    '/v1/senior-devices/session/refresh',
    {
      schema: {
        tags: ['Senior Devices'],
        body: {
          type: 'object',
          properties: {
            deviceId: { type: 'string' },
            refreshToken: { type: 'string', minLength: 64, maxLength: 64 },
          },
          required: ['deviceId', 'refreshToken'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  householdId: { type: 'string' },
                  householdName: { type: 'string' },
                  memberId: { type: 'string' },
                  userId: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  role: { type: 'string' },
                  permissions: { type: 'array', items: { type: 'string' } },
                  sessionToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
      preHandler: async () => undefined,
    },
    async (request, reply) => {
      try {
        const body = refreshDeviceSessionBodySchema.parse(request.body);
        const useCase = new RefreshSeniorDeviceSessionUseCase(repository);
        const result = await useCase.execute(body);

        return reply.status(200).send({
          status: 'success',
          data: result,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 6. POST /v1/households/:householdId/members/:memberId/archive - Archive a senior member
  fastify.post(
    '/v1/households/:householdId/members/:memberId/archive',
    {
      preHandler: requireUserAuth,
      schema: {
        tags: ['Senior Devices'],
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
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = archiveMemberParamsSchema.parse(request.params);
        const useCase = new ArchiveMemberUseCase(repository);

        await useCase.execute({
          householdId: params.householdId,
          memberId: params.memberId,
          requesterUserId: request.requester!.userId,
        });

        logAudit(repository, request, params.householdId, 'archive_senior', params.memberId);

        return reply.status(200).send({
          status: 'success',
          message: 'Member archived successfully.',
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 4b. POST /v1/households/:householdId/members/:memberId/restore - Restore archived member
  fastify.post(
    '/v1/households/:householdId/members/:memberId/restore',
    {
      preHandler: requireUserAuth,
      schema: {
        tags: ['Household Members'],
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
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = archiveMemberParamsSchema.parse(request.params);
        await ensureHouseholdPermission(request, repository, params.householdId, 'archiveMembers');
        const useCase = new RestoreMemberUseCase(repository);

        await useCase.execute({
          householdId: params.householdId,
          memberId: params.memberId,
          requesterUserId: request.requester!.userId,
        });

        return reply.status(200).send({
          status: 'success',
          message: 'Member restored successfully.',
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 4c. GET /v1/households/:householdId/members/archived - List archived members
  fastify.get(
    '/v1/households/:householdId/members/archived',
    {
      preHandler: requireUserAuth,
      schema: {
        tags: ['Household Members'],
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
              data: { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = z.object({ householdId: z.string() }).parse(request.params);
        const members = await repository.listArchivedHouseholdMembers(params.householdId);

        return reply.status(200).send({
          status: 'success',
          data: members,
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );

  // 5. POST /v1/households/:householdId/senior-devices/:deviceId/revoke - Revoke a device
  fastify.post(
    '/v1/households/:householdId/senior-devices/:deviceId/revoke',
    {
      preHandler: requireUserAuth,
      schema: {
        tags: ['Senior Devices'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            deviceId: { type: 'string' },
          },
          required: ['householdId', 'deviceId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const params = revokeDeviceParamsSchema.parse(request.params);
        const useCase = new RevokeSeniorDeviceUseCase(repository);

        await useCase.execute({
          householdId: params.householdId,
          deviceId: params.deviceId,
          requesterUserId: request.requester!.userId,
        });

        logAudit(repository, request, params.householdId, 'revoke_senior_device', params.deviceId);

        return reply.status(200).send({
          status: 'success',
          message: 'Senior device revoked successfully.',
        });
      } catch (error) {
        return handleDomainError(error, reply);
      }
    },
  );
};
