import { z } from 'zod';

export const journalCategorySchema = z.enum(['general', 'mood', 'meal', 'outing', 'visit', 'incident', 'other']);

export const createJournalEntryBodySchema = z.object({
  seniorId: z.string().uuid('Invalid senior ID format'),
  content: z.string().min(1).max(5000),
  category: journalCategorySchema.optional().default('general'),
});

export const updateJournalEntryBodySchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  category: journalCategorySchema.optional(),
});

export const journalEntryParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  entryId: z.string().uuid('Invalid entry ID format'),
});

export const listJournalEntriesQuerySchema = z.object({
  seniorId: z.string().uuid().optional(),
  category: journalCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
