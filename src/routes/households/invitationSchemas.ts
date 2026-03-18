import { z } from 'zod';

export const cancelInvitationParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  invitationId: z.string().uuid('Invalid invitation ID format'),
});

export const invitationCandidateSchema = z.object({
  firstName: z.string().max(80).optional().default(''),
  lastName: z.string().max(80).optional().default(''),
  email: z.string().email(),
  role: z.enum(['senior', 'caregiver', 'family', 'intervenant']),
});

export const bulkInvitationBodySchema = z.object({
  users: z.array(invitationCandidateSchema).min(1).max(50),
});

export const resolveQuerySchema = z.object({
  token: z.string().min(1),
});

export const acceptBodySchema = z.object({
  token: z.string().min(1).optional(),
  invitationId: z.string().min(1).optional(),
});

// Rate limiting for invitation sends (in-memory, per user)
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

export const maskEmail = (email: string): string => email.replace(/(^.).+(@.+$)/, '$1***$2');

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
