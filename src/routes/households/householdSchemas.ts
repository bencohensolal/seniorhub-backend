import { z } from 'zod';

// Shared household params schema — { householdId } is the root param for all household resources
export const paramsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
});

export const createHouseholdBodySchema = z.object({
  name: z.string().min(2).max(120),
});

// Shared JSON Schema for OpenAPI error responses
export const errorResponseSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string' },
  },
  required: ['status', 'message'],
} as const;
