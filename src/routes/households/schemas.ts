import { z } from 'zod';

// Zod schemas for request validation
export const paramsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
});

export const cancelInvitationParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  invitationId: z.string().uuid('Invalid invitation ID format'),
});

export const createHouseholdBodySchema = z.object({
  name: z.string().min(2).max(120),
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

// JSON Schema definitions for OpenAPI
export const errorResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
  },
  required: ['status', 'message'],
} as const;
