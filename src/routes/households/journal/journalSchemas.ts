import { z } from 'zod';

export const journalCategorySchema = z.enum(['general', 'mood', 'meal', 'outing', 'visit', 'incident', 'care', 'other']);

export const createJournalEntryBodySchema = z.object({
  seniorIds: z.array(z.string().uuid('Invalid senior ID format')).min(1, 'At least one senior is required'),
  content: z.string().min(1).max(5000),
  description: z.string().max(10000).optional(),
  category: journalCategorySchema.optional().default('general'),
});

export const updateJournalEntryBodySchema = z.object({
  seniorIds: z.array(z.string().uuid('Invalid senior ID format')).min(1, 'At least one senior is required').optional(),
  content: z.string().min(1).max(5000).optional(),
  description: z.string().max(10000).nullable().optional(),
  category: journalCategorySchema.optional(),
});

export const journalEntryParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  entryId: z.string().uuid('Invalid entry ID format'),
});

export const listJournalEntriesQuerySchema = z.object({
  seniorId: z.string().uuid().optional(),
  category: journalCategorySchema.optional(),
  archived: z.preprocess((v) => v === 'true' || v === '1', z.boolean()).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
