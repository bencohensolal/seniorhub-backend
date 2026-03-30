import { z } from 'zod';
import type { ScreenSettings } from '../../../domain/entities/TabletDisplayConfig.js';

// Screen type enum
const screenTypeSchema = z.enum(['summary', 'datetime', 'appointments', 'tasks', 'weekCalendar', 'monthCalendar', 'photoGallery', 'textScreen']);

// Screen settings schemas
const summaryScreenSettingsSchema = z.object({
  appointmentsPeriodDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  showTasksCount: z.boolean(),
  showAppointmentsCount: z.boolean(),
});

const dateTimeScreenSettingsSchema = z.object({
  timeFormat: z.enum(['12h', '24h']),
  dateFormat: z.enum(['short', 'long', 'full']),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g., #FFFFFF)'),
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge']),
  showSeconds: z.boolean(),
});

const appointmentsScreenSettingsSchema = z.object({
  maxAppointments: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
  fontSize: z.enum(['auto', 'small', 'medium', 'large']),
  showLocation: z.boolean(),
  showCaregiver: z.boolean(),
  periodDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
});

const tasksScreenSettingsSchema = z.object({
  periodDays: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]),
  maxTasks: z.number().int().min(1).max(50),
  fontSize: z.enum(['auto', 'small', 'medium', 'large']),
  showPriority: z.boolean(),
  filterByCategory: z.array(z.string()),
  sortBy: z.enum(['dueDate', 'priority', 'category']),
});

const weekCalendarScreenSettingsSchema = z.object({
  startDay: z.union([z.literal(0), z.literal(1), z.literal('today')]),
  displayMode: z.enum(['compact', 'detailed']),
  showWeekNumber: z.boolean(),
});

const monthCalendarScreenSettingsSchema = z.object({
  displayMode: z.enum(['compact', 'detailed']),
  showWeekNumbers: z.boolean(),
  highlightToday: z.boolean(),
});

const photoItemSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  caption: z.string().max(100).nullable().optional(),
  order: z.number().int().min(0).max(5),
  uploadedAt: z.string().datetime(),
});

const photoGalleryScreenSettingsSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  photos: z.array(photoItemSchema).max(6),
  displayMode: z.enum(['slideshow', 'mosaic', 'single']),
  slideshowDuration: z.union([z.literal(3), z.literal(5), z.literal(10), z.literal(15), z.literal(30)]).optional(),
  slideshowTransition: z.enum(['fade', 'slide', 'none']).optional(),
  slideshowOrder: z.enum(['sequential', 'random']).optional(),
  showCaptions: z.boolean(),
});

const textScreenSettingsSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(100),
  body: z.string().max(2000).nullable(),
  fontFamily: z.enum(['sans-serif', 'serif', 'monospace']),
  fontSize: z.enum(['small', 'medium', 'large', 'xlarge']),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  textAlign: z.enum(['left', 'center', 'right']),
  backgroundType: z.enum(['solid', 'gradient']),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  backgroundColorEnd: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
  gradientDirection: z.enum(['to-bottom', 'to-right', 'to-bottom-right']),
  icon: z.string().max(50).nullable(),
  animation: z.enum(['none', 'fade-in', 'slide-up', 'zoom-in']),
});

// Screen configuration schema
const screenConfigSchema = z.object({
  type: screenTypeSchema,
  enabled: z.boolean(),
  order: z.number().int().min(0),
  settings: z.any().optional(), // Union of all settings types, validated separately
});

// Main tablet display config schema
export const tabletDisplayConfigSchema = z.object({
  slideDuration: z.number().int().min(1000).max(60000),
  dataCacheDuration: z.number().int().min(60000).max(3600000),
  dataRefreshInterval: z.number().int().min(60000).max(3600000),
  kioskModeEnabled: z.boolean(),
  language: z.enum(['en', 'fr']),
  tapToAdvanceEnabled: z.boolean(),
  showCountdownEnabled: z.boolean(),
  screens: z.array(screenConfigSchema).min(1),
}).refine((data) => {
  // Validate unique screen orders
  const orders = data.screens.map(s => s.order);
  const uniqueOrders = new Set(orders);
  return uniqueOrders.size === orders.length;
}, {
  message: 'Screen orders must be unique',
}).refine((data) => {
  // Validate screen orders are consecutive (0, 1, 2, ...)
  const orders = data.screens.map(s => s.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i) {
      return false;
    }
  }
  return true;
}, {
  message: 'Screen orders must be consecutive starting from 0',
});

// Helper function to validate screen settings based on type
export function validateScreenSettings(screen: { type: string; settings?: ScreenSettings }): boolean {
  if (!screen.settings) {
    return true; // Settings are optional
  }

  try {
    switch (screen.type) {
      case 'summary':
        summaryScreenSettingsSchema.parse(screen.settings);
        break;
      case 'datetime':
        dateTimeScreenSettingsSchema.parse(screen.settings);
        break;
      case 'appointments':
        appointmentsScreenSettingsSchema.parse(screen.settings);
        break;
      case 'tasks':
        tasksScreenSettingsSchema.parse(screen.settings);
        break;
      case 'weekCalendar':
        weekCalendarScreenSettingsSchema.parse(screen.settings);
        break;
      case 'monthCalendar':
        monthCalendarScreenSettingsSchema.parse(screen.settings);
        break;
      case 'photoGallery':
        photoGalleryScreenSettingsSchema.parse(screen.settings);
        break;
      case 'textScreen':
        textScreenSettingsSchema.parse(screen.settings);
        break;
      default:
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
