import { z } from 'zod';
import { MAX_TEXT_SCREEN_TITLE_LENGTH, MAX_TEXT_SCREEN_BODY_LENGTH } from '../../../domain/entities/TextScreen.js';

export const createTextScreenSchema = z.object({
  title: z.string().min(1).max(MAX_TEXT_SCREEN_TITLE_LENGTH).trim(),
  body: z.string().max(MAX_TEXT_SCREEN_BODY_LENGTH).trim().nullable().optional(),
  order: z.number().int().min(0).optional(),
  fontFamily: z.enum(['sans-serif', 'serif', 'monospace']).optional(),
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge']).optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  backgroundType: z.enum(['solid', 'gradient']).optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  backgroundColorEnd: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  gradientDirection: z.enum(['to-bottom', 'to-right', 'to-bottom-right']).optional(),
  icon: z.string().max(50).nullable().optional(),
  animation: z.enum(['none', 'fade-in', 'slide-up', 'zoom-in']).optional(),
});

export const updateTextScreenSchema = createTextScreenSchema.partial();

export const textScreenParamsSchema = z.object({
  householdId: z.string(),
  tabletId: z.string(),
  screenId: z.string(),
});
