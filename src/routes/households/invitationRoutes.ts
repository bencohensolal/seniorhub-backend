import type { FastifyInstance } from 'fastify';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import type { AcceptInvitationUseCase } from '../../domain/usecases/AcceptInvitationUseCase.js';
import type { CancelInvitationUseCase } from '../../domain/usecases/CancelInvitationUseCase.js';
import type { CreateBulkInvitationsUseCase } from '../../domain/usecases/CreateBulkInvitationsUseCase.js';
import type { EnsureHouseholdRoleUseCase } from '../../domain/usecases/EnsureHouseholdRoleUseCase.js';
import type { ListPendingInvitationsUseCase } from '../../domain/usecases/ListPendingInvitationsUseCase.js';
import type { ListHouseholdInvitationsUseCase } from '../../domain/usecases/ListHouseholdInvitationsUseCase.js';
import type { ResolveInvitationUseCase } from '../../domain/usecases/ResolveInvitationUseCase.js';
import type { ResendInvitationUseCase } from '../../domain/usecases/ResendInvitationUseCase.js';
import { invitationEmailRuntime } from '../../data/services/email/invitationEmailRuntime.js';
import { env } from '../../config/env.js';
import {
  paramsSchema,
  bulkInvitationBodySchema,
  resolveQuerySchema,
  acceptBodySchema,
  cancelInvitationParamsSchema,
  errorResponseSchema,
} from './schemas.js';
import { checkInviteRateLimit, maskEmail, sanitizeInvitation } from './utils.js';

/**
 * Detects if the request is coming from a mobile device
 */
const isMobileDevice = (userAgent: string | undefined): boolean => {
  if (!userAgent) return false;
  
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgent);
};

export const registerInvitationRoutes = (
  fastify: FastifyInstance,
  repository: HouseholdRepository,
  useCases: {
    createBulkInvitationsUseCase: CreateBulkInvitationsUseCase;
    ensureHouseholdRoleUseCase: EnsureHouseholdRoleUseCase;
    listPendingInvitationsUseCase: ListPendingInvitationsUseCase;
    listHouseholdInvitationsUseCase: ListHouseholdInvitationsUseCase;
    resolveInvitationUseCase: ResolveInvitationUseCase;
    acceptInvitationUseCase: AcceptInvitationUseCase;
    cancelInvitationUseCase: CancelInvitationUseCase;
    resendInvitationUseCase: ResendInvitationUseCase;
  },
) => {
  // GET /v1/invitations/accept-link - Smart redirect for invitation acceptance
  // This is a PUBLIC endpoint (no auth required) - used in email links
  fastify.get(
    '/v1/invitations/accept-link',
    {
      schema: {
        tags: ['Invitations'],
        querystring: {
          type: 'object',
          properties: { token: { type: 'string' } },
          required: ['token'],
        },
        response: {
          302: {
            description: 'Redirect to mobile app or web frontend',
            type: 'null',
          },
          400: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['error'] },
              message: { type: 'string' },
            },
            required: ['status', 'message'],
          },
          404: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['error'] },
              message: { type: 'string' },
            },
            required: ['status', 'message'],
          },
        },
      },
      // Override onRequest hook to make this endpoint public (no auth check)
      onRequest: async (_request, _reply) => {
        // Skip authentication - this is a public endpoint
      },
    },
    async (request, reply) => {
      const queryResult = resolveQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        return reply.status(400).send({ 
          status: 'error', 
          message: 'Token manquant ou invalide.' 
        });
      }

      const token = queryResult.data.token;

      try {
        // Validate that the invitation exists and is still valid
        await useCases.resolveInvitationUseCase.execute({ token });

        // Detect if user is on mobile device
        const userAgent = request.headers['user-agent'];
        const isMobile = isMobileDevice(userAgent);

        console.info('[Invitations] Smart redirect for invitation acceptance:', {
          token: token.substring(0, 8) + '...',
          userAgent,
          isMobile,
        });

        let redirectUrl: string;

        if (isMobile) {
          // Redirect to mobile app deep link
          redirectUrl = `seniorhub://invite?type=household-invite&token=${encodeURIComponent(token)}`;
          console.info('[Invitations] Redirecting to mobile app:', redirectUrl);
        } else {
          // Redirect to web frontend
          const frontendUrl = env.FRONTEND_URL;
          redirectUrl = `${frontendUrl}/accept-invitation?token=${encodeURIComponent(token)}`;
          console.info('[Invitations] Redirecting to web frontend:', redirectUrl);
        }

        return reply.redirect(redirectUrl, 302);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inattendue.';
        console.error('[Invitations] Failed to resolve invitation for redirect:', {
          error: message,
          token: token.substring(0, 8) + '...',
        });

        return reply.status(404).send({ 
          status: 'error', 
          message: 'Invitation introuvable ou expirée.' 
        });
      }
    },
  );

  // POST /v1/households/:householdId/invitations/bulk - Create bulk invitations
  fastify.post(
    '/v1/households/:householdId/invitations/bulk',
    {
      schema: {
        tags: ['Invitations'],
        params: {
          type: 'object',
          properties: { householdId: { type: 'string' } },
          required: ['householdId'],
        },
        body: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['senior', 'caregiver', 'family', 'intervenant'] },
                },
                required: ['email', 'role'],
              },
            },
          },
          required: ['users'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  acceptedCount: { type: 'number' },
                  skippedDuplicates: { type: 'number' },
                  perUserErrors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        email: { type: 'string' },
                        reason: { type: 'string' },
                      },
                      required: ['email', 'reason'],
                    },
                  },
                  deliveries: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        invitationId: { type: 'string' },
                        inviteeEmail: { type: 'string' },
                        status: { type: 'string', enum: ['sent', 'failed'] },
                        deepLinkUrl: { type: 'string' },
                        fallbackUrl: { type: ['string', 'null'] },
                        reason: { type: ['string', 'null'] },
                      },
                      required: ['invitationId', 'inviteeEmail', 'status', 'deepLinkUrl', 'fallbackUrl', 'reason'],
                    },
                  },
                },
                required: ['acceptedCount', 'skippedDuplicates', 'perUserErrors', 'deliveries'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = paramsSchema.safeParse(request.params);
      const payloadResult = bulkInvitationBodySchema.safeParse(request.body);

      console.info('[INVITE] Received bulk invitation request:', {
        householdId: request.params,
        body: request.body,
        paramsValid: paramsResult.success,
        payloadValid: payloadResult.success,
      });

      if (!paramsResult.success || !payloadResult.success) {
        console.error('[INVITE] Validation failed:', {
          paramsError: paramsResult.success ? null : paramsResult.error,
          payloadError: payloadResult.success ? null : payloadResult.error,
        });
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
        await useCases.ensureHouseholdRoleUseCase.execute({
          householdId: paramsResult.data.householdId,
          requesterUserId: request.requester.userId,
          allowedRoles: ['caregiver'],
        });

        const result = await useCases.createBulkInvitationsUseCase.execute({
          householdId: paramsResult.data.householdId,
          requester: request.requester,
          users: payloadResult.data.users,
        });

        const emailJobs = result.deliveries.map((delivery) => {
          const sourceUser = payloadResult.data.users.find(
            (user) => user.email.trim().toLowerCase() === delivery.inviteeEmail,
          );

          return {
            invitationId: delivery.invitationId,
            inviteeEmail: delivery.inviteeEmail,
            inviteeFirstName: sourceUser?.firstName ?? 'there',
            assignedRole: sourceUser?.role ?? 'senior',
            acceptLinkUrl: delivery.acceptLinkUrl,
            deepLinkUrl: delivery.deepLinkUrl,
            fallbackUrl: delivery.fallbackUrl,
          };
        });

        console.info('[Invitations] Enqueuing bulk emails:', {
          count: emailJobs.length,
          recipients: emailJobs.map(j => j.inviteeEmail),
        });

        invitationEmailRuntime.queue.enqueueBulk(emailJobs);

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
    },
  );

  // GET /v1/households/:householdId/invitations - List household invitations
  fastify.get(
    '/v1/households/:householdId/invitations',
    {
      schema: {
        tags: ['Invitations'],
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
              data: { type: 'array' },
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
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const invitations = await useCases.listHouseholdInvitationsUseCase.execute({
          householdId: paramsResult.data.householdId,
          requesterUserId: request.requester.userId,
        });

        return reply.status(200).send({
          status: 'success',
          data: invitations.map(sanitizeInvitation),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        return reply.status(403).send({ status: 'error', message });
      }
    },
  );

  // GET /v1/households/invitations/my-pending - List pending invitations
  fastify.get(
    '/v1/households/invitations/my-pending',
    {
      schema: {
        tags: ['Invitations'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: { type: 'array' },
            },
            required: ['status', 'data'],
          },
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const pending = await useCases.listPendingInvitationsUseCase.execute({ requester: request.requester });

      return reply.status(200).send({
        status: 'success',
        data: pending.map(sanitizeInvitation),
      });
    },
  );

  // GET /v1/households/invitations/resolve - Resolve invitation by token
  fastify.get(
    '/v1/households/invitations/resolve',
    {
      schema: {
        tags: ['Invitations'],
        querystring: {
          type: 'object',
          properties: { token: { type: 'string' } },
          required: ['token'],
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
                  householdId: { type: 'string' },
                  inviteeFirstName: { type: 'string' },
                  inviteeLastName: { type: 'string' },
                  inviteeEmailMasked: { type: 'string' },
                  assignedRole: { type: 'string', enum: ['senior', 'caregiver'] },
                  status: { type: 'string' },
                  tokenExpiresAt: { type: 'string' },
                  createdAt: { type: 'string' },
                },
                required: [
                  'id',
                  'householdId',
                  'inviteeFirstName',
                  'inviteeLastName',
                  'inviteeEmailMasked',
                  'assignedRole',
                  'status',
                  'tokenExpiresAt',
                  'createdAt',
                ],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const queryResult = resolveQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        return reply.status(400).send({ status: 'error', message: 'Invalid request payload.' });
      }

      try {
        const invitation = await useCases.resolveInvitationUseCase.execute({ token: queryResult.data.token });

        return reply.status(200).send({
          status: 'success',
          data: sanitizeInvitation(invitation),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        return reply.status(404).send({ status: 'error', message });
      }
    },
  );

  // POST /v1/households/invitations/accept - Accept invitation
  fastify.post(
    '/v1/households/invitations/accept',
    {
      schema: {
        tags: ['Invitations'],
        body: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            invitationId: { type: 'string' },
          },
          additionalProperties: false,
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
                  role: { type: 'string', enum: ['senior', 'caregiver'] },
                },
                required: ['householdId', 'role'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
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

        const result = await useCases.acceptInvitationUseCase.execute({
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
    },
  );

  // POST /v1/households/:householdId/invitations/:invitationId/resend - Resend invitation
  fastify.post(
    '/v1/households/:householdId/invitations/:invitationId/resend',
    {
      schema: {
        tags: ['Invitations'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            invitationId: { type: 'string' },
          },
          required: ['householdId', 'invitationId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  newExpiresAt: { type: 'string' },
                },
                required: ['newExpiresAt'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = cancelInvitationParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        const result = await useCases.resendInvitationUseCase.execute({
          householdId: paramsResult.data.householdId,
          invitationId: paramsResult.data.invitationId,
          requester: request.requester,
        });

        // Get the invitation to extract invitee details for email
        const invitations = await repository.listHouseholdInvitations(paramsResult.data.householdId);
        const invitation = invitations.find((inv) => inv.id === paramsResult.data.invitationId);

        if (invitation) {
          console.info('[Invitations] Resending invitation email:', {
            invitationId: paramsResult.data.invitationId,
            inviteeEmail: invitation.inviteeEmail,
          });

          // Queue the email with the new token
          invitationEmailRuntime.queue.enqueueBulk([{
            invitationId: paramsResult.data.invitationId,
            inviteeEmail: invitation.inviteeEmail,
            inviteeFirstName: invitation.inviteeFirstName,
            assignedRole: invitation.assignedRole,
            acceptLinkUrl: result.acceptLinkUrl,
            deepLinkUrl: result.deepLinkUrl,
            fallbackUrl: result.fallbackUrl,
          }]);
        } else {
          console.warn('[Invitations] Cannot resend email - invitation not found:', {
            invitationId: paramsResult.data.invitationId,
          });
        }

        await repository.logAuditEvent({
          householdId: paramsResult.data.householdId,
          actorUserId: request.requester.userId,
          action: 'invitation_resent',
          targetId: paramsResult.data.invitationId,
          metadata: {
            requesterEmailMasked: maskEmail(request.requester.email),
          },
        });

        return reply.status(200).send({
          status: 'success',
          data: { newExpiresAt: result.newExpiresAt },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        const statusCode =
          message === 'Only caregivers can resend invitations.'
            ? 403
            : message === 'Invitation not found.'
              ? 404
              : 409;

        return reply.status(statusCode).send({
          status: 'error',
          message,
        });
      }
    },
  );

  // POST /v1/households/:householdId/invitations/:invitationId/cancel - Cancel invitation
  fastify.post(
    '/v1/households/:householdId/invitations/:invitationId/cancel',
    {
      schema: {
        tags: ['Invitations'],
        params: {
          type: 'object',
          properties: {
            householdId: { type: 'string' },
            invitationId: { type: 'string' },
          },
          required: ['householdId', 'invitationId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['success'] },
              data: {
                type: 'object',
                properties: {
                  cancelled: { type: 'boolean' },
                },
                required: ['cancelled'],
              },
            },
            required: ['status', 'data'],
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const paramsResult = cancelInvitationParamsSchema.safeParse(request.params);
      if (!paramsResult.success) {
        return reply.status(400).send({
          status: 'error',
          message: 'Invalid request payload.',
        });
      }

      try {
        await useCases.cancelInvitationUseCase.execute({
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
    },
  );
};
