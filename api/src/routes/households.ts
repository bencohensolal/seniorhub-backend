import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AcceptInvitationUseCase } from '../domain/usecases/AcceptInvitationUseCase.js';
import { CancelInvitationUseCase } from '../domain/usecases/CancelInvitationUseCase.js';
import { CreateBulkInvitationsUseCase } from '../domain/usecases/CreateBulkInvitationsUseCase.js';
import { CreateHouseholdUseCase } from '../domain/usecases/CreateHouseholdUseCase.js';
import { EnsureHouseholdRoleUseCase } from '../domain/usecases/EnsureHouseholdRoleUseCase.js';
import { GetHouseholdOverviewUseCase } from '../domain/usecases/GetHouseholdOverviewUseCase.js';
import { ListPendingInvitationsUseCase } from '../domain/usecases/ListPendingInvitationsUseCase.js';
import { ResolveInvitationUseCase } from '../domain/usecases/ResolveInvitationUseCase.js';
import { createHouseholdRepository } from '../data/repositories/createHouseholdRepository.js';
import { invitationEmailRuntime } from '../data/services/email/invitationEmailRuntime.js';

const paramsSchema = z.object({
  householdId: z.string().min(1),
});

const cancelInvitationParamsSchema = z.object({
  householdId: z.string().min(1),
  invitationId: z.string().min(1),
});

const createHouseholdBodySchema = z.object({
  name: z.string().min(2).max(120),
});

const invitationCandidateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  role: z.enum(['senior', 'caregiver']),
});

const bulkInvitationBodySchema = z.object({
  users: z.array(invitationCandidateSchema).min(1).max(50),
});

const resolveQuerySchema = z.object({
  token: z.string().min(1),
});

const acceptBodySchema = z
  .object({
    token: z.string().min(1).optional(),
    invitationId: z.string().min(1).optional(),
  });

const inviteRateState = new Map<string, { count: number; windowStartMs: number }>();
const INVITE_RATE_LIMIT = 10;
const INVITE_WINDOW_MS = 60_000;

const checkInviteRateLimit = (userId: string): boolean => {
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

const sanitizeInvitation = (invitation: {
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
  inviteeEmailMasked: invitation.inviteeEmail.replace(/(^.).+(@.+$)/, '$1***$2'),
  assignedRole: invitation.assignedRole,
  status: invitation.status,
  tokenExpiresAt: invitation.tokenExpiresAt,
  createdAt: invitation.createdAt,
});

const maskEmail = (email: string): string => email.replace(/(^.).+(@.+$)/, '$1***$2');

export const householdsRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = createHouseholdRepository();
  const getHouseholdOverviewUseCase = new GetHouseholdOverviewUseCase(repository);
  const createHouseholdUseCase = new CreateHouseholdUseCase(repository);
  const ensureHouseholdRoleUseCase = new EnsureHouseholdRoleUseCase(repository);
  const createBulkInvitationsUseCase = new CreateBulkInvitationsUseCase(repository);
  const listPendingInvitationsUseCase = new ListPendingInvitationsUseCase(repository);
  const resolveInvitationUseCase = new ResolveInvitationUseCase(repository);
  const acceptInvitationUseCase = new AcceptInvitationUseCase(repository);
  const cancelInvitationUseCase = new CancelInvitationUseCase(repository);

  fastify.post('/v1/households', async (request, reply) => {
    const payloadResult = createHouseholdBodySchema.safeParse(request.body);
    if (!payloadResult.success) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid request payload.',
      });
    }

    const household = await createHouseholdUseCase.execute({
      name: payloadResult.data.name,
      requester: request.requester,
    });

    return reply.status(201).send({
      status: 'success',
      data: household,
    });
  });

  fastify.post('/v1/households/:householdId/invitations/bulk', async (request, reply) => {
    const paramsResult = paramsSchema.safeParse(request.params);
    const payloadResult = bulkInvitationBodySchema.safeParse(request.body);

    if (!paramsResult.success || !payloadResult.success) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid request payload.',
      });
    }

    if (!checkInviteRateLimit(request.requester.userId)) {
      return reply.status(429).send({
        status: 'error',
        message: 'Invitation rate limit reached. Please try again later.',
      });
    }

    try {
      await ensureHouseholdRoleUseCase.execute({
        householdId: paramsResult.data.householdId,
        requesterUserId: request.requester.userId,
        allowedRoles: ['caregiver'],
      });

      const result = await createBulkInvitationsUseCase.execute({
        householdId: paramsResult.data.householdId,
        requester: request.requester,
        users: payloadResult.data.users,
      });

      invitationEmailRuntime.queue.enqueueBulk(
        result.deliveries.map((delivery) => {
          const sourceUser = payloadResult.data.users.find(
            (user) => user.email.trim().toLowerCase() === delivery.inviteeEmail,
          );

          return {
          invitationId: delivery.invitationId,
          inviteeEmail: delivery.inviteeEmail,
          inviteeFirstName: sourceUser?.firstName ?? 'there',
          assignedRole: sourceUser?.role ?? 'senior',
          deepLinkUrl: delivery.deepLinkUrl,
          fallbackUrl: delivery.fallbackUrl,
          };
        }),
      );

      for (const delivery of result.deliveries) {
        await repository.logAuditEvent({
          householdId: paramsResult.data.householdId,
          actorUserId: request.requester.userId,
          action: 'invitation_created',
          targetId: delivery.invitationId,
          metadata: {
            inviteeEmailMasked: maskEmail(delivery.inviteeEmail),
          },
        });
      }

      return reply.status(200).send({
        status: 'success',
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      const statusCode =
        message === 'Only caregivers can send invitations.' || message === 'Insufficient household role.'
          ? 403
          : message === 'Access denied to this household.'
            ? 403
            : 404;
      return reply.status(statusCode).send({ status: 'error', message: 'Unable to create invitations.' });
    }
  });

  fastify.get('/v1/households/invitations/my-pending', async (request, reply) => {
    const pending = await listPendingInvitationsUseCase.execute({ requester: request.requester });

    return reply.status(200).send({
      status: 'success',
      data: pending.map(sanitizeInvitation),
    });
  });

  fastify.get('/v1/households/invitations/resolve', async (request, reply) => {
    const queryResult = resolveQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
    }

    try {
      const invitation = await resolveInvitationUseCase.execute({ token: queryResult.data.token });

      return reply.status(200).send({
        status: 'success',
        data: sanitizeInvitation(invitation),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      return reply.status(404).send({ status: 'error', message });
    }
  });

  fastify.post('/v1/households/invitations/accept', async (request, reply) => {
    const payloadResult = acceptBodySchema.safeParse(request.body);
    if (!payloadResult.success) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid request payload.',
      });
    }

    try {
      const invitationIdentifier = payloadResult.data.token
        ? { token: payloadResult.data.token }
        : payloadResult.data.invitationId
          ? { invitationId: payloadResult.data.invitationId }
          : {};

      const result = await acceptInvitationUseCase.execute({
        requester: request.requester,
        ...invitationIdentifier,
      });

      await repository.logAuditEvent({
        householdId: result.householdId,
        actorUserId: request.requester.userId,
        action: 'invitation_accepted',
        targetId: payloadResult.data.invitationId ?? payloadResult.data.token ?? 'pending-email-selection',
        metadata: {
          requesterEmailMasked: maskEmail(request.requester.email),
        },
      });

      return reply.status(200).send({
        status: 'success',
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      const statusCode =
        message === 'Access denied to this invitation.'
          ? 403
          : message === 'Invitation not found.'
            ? 404
            : 409;

      return reply.status(statusCode).send({
        status: 'error',
        message,
      });
    }
  });

  fastify.post('/v1/households/:householdId/invitations/:invitationId/cancel', async (request, reply) => {
    const paramsResult = cancelInvitationParamsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid request payload.',
      });
    }

    try {
      await cancelInvitationUseCase.execute({
        householdId: paramsResult.data.householdId,
        invitationId: paramsResult.data.invitationId,
        requester: request.requester,
      });

      await repository.logAuditEvent({
        householdId: paramsResult.data.householdId,
        actorUserId: request.requester.userId,
        action: 'invitation_cancelled',
        targetId: paramsResult.data.invitationId,
        metadata: {
          requesterEmailMasked: maskEmail(request.requester.email),
        },
      });

      return reply.status(200).send({
        status: 'success',
        data: { cancelled: true },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      const statusCode =
        message === 'Only caregivers can cancel invitations.'
          ? 403
          : message === 'Invitation not found.'
            ? 404
            : 409;

      return reply.status(statusCode).send({
        status: 'error',
        message,
      });
    }
  });

  fastify.get('/v1/observability/invitations/email-metrics', async (_request, reply) => {
    return reply.status(200).send({
      status: 'success',
      data: invitationEmailRuntime.metrics.snapshot(),
    });
  });

  fastify.get('/v1/households/:householdId/overview', async (request, reply) => {
    const paramsResult = paramsSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.status(400).send({
        status: 'error',
        message: 'Invalid request payload.',
      });
    }

    try {
      const overview = await getHouseholdOverviewUseCase.execute({
        householdId: paramsResult.data.householdId,
        requesterUserId: request.requester.userId,
      });

      return reply.status(200).send({
        status: 'success',
        data: overview,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      const statusCode = message === 'Access denied to this household.' ? 403 : 404;

      return reply.status(statusCode).send({
        status: 'error',
        message,
      });
    }
  });
};
