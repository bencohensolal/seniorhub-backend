import { z } from 'zod';

// Time validation regex for HH:MM format (00:00 to 23:59)
const TIME_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

// Medication form enum schema
export const medicationFormSchema = z.enum([
  'tablet',
  'capsule',
  'syrup',
  'injection',
  'drops',
  'cream',
  'patch',
  'inhaler',
  'suppository',
  'other',
]);

// Schema for creating a new medication
export const createMedicationBodySchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().min(1).max(100),
  form: medicationFormSchema,
  frequency: z.string().min(1).max(200),
  schedule: z.array(
    z.string().regex(TIME_REGEX, 'Time must be in HH:MM format (00:00 to 23:59)')
  ).min(1, 'At least one scheduled time is required'),
  prescribedBy: z.string().max(200).optional(),
  prescriptionDate: z.string().datetime().optional(), // ISO date string
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  instructions: z.string().max(1000).optional(),
});

// Schema for updating an existing medication (all fields optional for partial update)
export const updateMedicationBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  dosage: z.string().min(1).max(100).optional(),
  form: medicationFormSchema.optional(),
  frequency: z.string().min(1).max(200).optional(),
  schedule: z.array(
    z.string().regex(TIME_REGEX, 'Time must be in HH:MM format (00:00 to 23:59)')
  ).min(1, 'At least one scheduled time is required').optional(),
  prescribedBy: z.string().max(200).nullable().optional(),
  prescriptionDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().nullable().optional(),
  instructions: z.string().max(1000).nullable().optional(),
});

// Schema for medication URL parameters
export const medicationParamsSchema = z.object({
  householdId: z.string().min(1),
  medicationId: z.string().min(1),
});

// Schema for medication reminder URL parameters
export const reminderParamsSchema = z.object({
  householdId: z.string().min(1),
  medicationId: z.string().min(1),
  reminderId: z.string().min(1),
});

// Schema for creating a medication reminder
export const createReminderBodySchema = z.object({
  time: z.string().regex(TIME_REGEX, 'Time must be in HH:MM format (00:00 to 23:59)'),
  daysOfWeek: z.array(
    z.number().int().min(0).max(6)
  ).min(1, 'At least one day must be selected').refine(
    (days) => new Set(days).size === days.length,
    { message: 'Days of week must be unique' }
  ),
  enabled: z.boolean().optional().default(true),
});

// Schema for updating a medication reminder
export const updateReminderBodySchema = z.object({
  time: z.string().regex(TIME_REGEX, 'Time must be in HH:MM format (00:00 to 23:59)').optional(),
  daysOfWeek: z.array(
    z.number().int().min(0).max(6)
  ).min(1, 'At least one day must be selected').refine(
    (days) => new Set(days).size === days.length,
    { message: 'Days of week must be unique' }
  ).optional(),
  enabled: z.boolean().optional(),
});
