import { z } from 'zod';
import {
  MAX_PHOTO_SCREEN_NAME_LENGTH,
  MAX_PHOTO_CAPTION_LENGTH,
  MAX_PHOTOS_PER_SCREEN,
} from '../../../domain/entities/PhotoScreen.js';

// Photo Screen schemas
export const createPhotoScreenSchema = z.object({
  name: z.string().min(3).max(MAX_PHOTO_SCREEN_NAME_LENGTH).trim(),
  order: z.number().int().min(0).optional(),
  displayMode: z.enum(['slideshow', 'mosaic', 'single']).optional(),
  slideshowDuration: z.number().int().refine(val => [3, 5, 10, 15, 30].includes(val), {
    message: 'Slideshow duration must be 3, 5, 10, 15, or 30 seconds',
  }).optional(),
  slideshowTransition: z.enum(['fade', 'slide', 'none']).optional(),
  slideshowOrder: z.enum(['sequential', 'random']).optional(),
  showCaptions: z.boolean().optional(),
});

export const updatePhotoScreenSchema = z.object({
  name: z.string().min(3).max(MAX_PHOTO_SCREEN_NAME_LENGTH).trim().optional(),
  order: z.number().int().min(0).optional(),
  displayMode: z.enum(['slideshow', 'mosaic', 'single']).optional(),
  slideshowDuration: z.number().int().refine(val => [3, 5, 10, 15, 30].includes(val), {
    message: 'Slideshow duration must be 3, 5, 10, 15, or 30 seconds',
  }).optional(),
  slideshowTransition: z.enum(['fade', 'slide', 'none']).optional(),
  slideshowOrder: z.enum(['sequential', 'random']).optional(),
  showCaptions: z.boolean().optional(),
});

// Photo schemas
export const updatePhotoSchema = z.object({
  caption: z.string().max(MAX_PHOTO_CAPTION_LENGTH).trim().nullable().optional(),
  order: z.number().int().min(0).max(MAX_PHOTOS_PER_SCREEN - 1).optional(),
});

export const reorderPhotosSchema = z.object({
  photoOrders: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().min(0).max(MAX_PHOTOS_PER_SCREEN - 1),
    }),
  ).min(1).max(MAX_PHOTOS_PER_SCREEN),
});

// Route params schemas
export const photoScreenParamsSchema = z.object({
  householdId: z.string(),
  tabletId: z.string(),
  screenId: z.string(),
});

export const photoParamsSchema = z.object({
  householdId: z.string(),
  tabletId: z.string(),
  screenId: z.string(),
  photoId: z.string(),
});
