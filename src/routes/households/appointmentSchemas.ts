import { z } from 'zod';

// Time validation regex for HH:MM format (00:00 to 23:59)
const TIME_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

// Appointment type enum schema
export const appointmentTypeSchema = z.enum([
  'doctor',
  'specialist',
  'dentist',
  'lab',
  'imaging',
  'therapy',
  'pharmacy',
  'hospital',
  'other',
]);

// Appointment status enum schema
export const appointmentStatusSchema = z.enum([
  'scheduled',
  'confirmed',
  'cancelled',
  'completed',
  'missed',
]);

// Recurrence frequency enum schema
export const recurrenceFrequencySchema = z.enum([
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
]);

// Recurrence schema
export const recurrenceSchema = z.object({
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().positive(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endDate: z.string().datetime().optional(),
  occurrences: z.number().int().positive().optional(),
});

// Schema for creating a new appointment
export const createAppointmentBodySchema = z.object({
  title: z.string().min(1).max(200),
  type: appointmentTypeSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  time: z.string().regex(TIME_REGEX, 'Time must be in HH:MM format (00:00 to 23:59)'),
  duration: z.number().int().positive().optional(),
  seniorIds: z.array(z.string().uuid()).min(1, 'At least one senior must be assigned'),
  caregiverId: z.string().uuid().optional(),
  address: z.string().max(500).optional(),
  locationName: z.string().max(255).optional(),
  phoneNumber: z.string().max(50).optional(),
  description: z.string().max(1000).optional(),
  professionalName: z.string().max(255).optional(),
  preparation: z.string().max(1000).optional(),
  documentsToTake: z.string().max(500).optional(),
  transportArrangement: z.string().max(500).optional(),
  recurrence: recurrenceSchema.optional(),
  status: appointmentStatusSchema.optional(),
  notes: z.string().max(1000).optional(),
});

// Schema for updating an existing appointment (all fields optional for partial update)
export const updateAppointmentBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: appointmentTypeSchema.optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  time: z.string().regex(TIME_REGEX, 'Time must be in HH:MM format (00:00 to 23:59)').optional(),
  duration: z.number().int().positive().nullable().optional(),
  seniorIds: z.array(z.string().uuid()).min(1, 'At least one senior must be assigned').optional(),
  caregiverId: z.string().uuid().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  locationName: z.string().max(255).nullable().optional(),
  phoneNumber: z.string().max(50).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  professionalName: z.string().max(255).nullable().optional(),
  preparation: z.string().max(1000).nullable().optional(),
  documentsToTake: z.string().max(500).nullable().optional(),
  transportArrangement: z.string().max(500).nullable().optional(),
  recurrence: recurrenceSchema.nullable().optional(),
  status: appointmentStatusSchema.optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// Schema for appointment URL parameters
export const appointmentParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  appointmentId: z.string().uuid('Invalid appointment ID format'),
});

// Schema for appointment reminder URL parameters
export const appointmentReminderParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  appointmentId: z.string().uuid('Invalid appointment ID format'),
  reminderId: z.string().uuid('Invalid reminder ID format'),
});

// Schema for creating an appointment reminder
export const createAppointmentReminderBodySchema = z.object({
  triggerBefore: z.number().int().positive('Trigger time must be a positive number of minutes'),
  customMessage: z.string().max(500).optional(),
  enabled: z.boolean().optional().default(true),
});

// Schema for updating an appointment reminder
export const updateAppointmentReminderBodySchema = z.object({
  triggerBefore: z.number().int().positive('Trigger time must be a positive number of minutes').optional(),
  customMessage: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
});
