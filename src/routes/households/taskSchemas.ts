import { z } from 'zod';

// Time validation regex for HH:MM format (00:00 to 23:59)
const TIME_REGEX = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

// Task category enum schema
export const taskCategorySchema = z.enum([
  'hydration',
  'nutrition',
  'exercise',
  'social',
  'household',
  'wellbeing',
  'other',
]);

// Task priority enum schema
export const taskPrioritySchema = z.enum(['low', 'normal', 'high']);

// Task status enum schema
export const taskStatusSchema = z.enum(['pending', 'completed', 'cancelled']);

// Recurrence frequency enum schema
export const recurrenceFrequencySchema = z.enum([
  'none',
  'daily',
  'weekly',
  'monthly',
]);

// Task recurrence schema
export const taskRecurrenceSchema = z.object({
  frequency: recurrenceFrequencySchema,
  interval: z.number().int().min(1).max(365),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  endDate: z.string().optional(), // ISO date
  occurrences: z.number().int().min(1).optional(),
});

// Schema for creating a new task
export const createTaskBodySchema = z.object({
  seniorId: z.string().uuid('Invalid senior ID format'),
  caregiverId: z.string().uuid('Invalid caregiver ID format').optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: taskCategorySchema,
  priority: taskPrioritySchema.optional().default('normal'),
  dueDate: z.string().optional(), // ISO date YYYY-MM-DD
  dueTime: z.string().regex(TIME_REGEX, 'Time must be in HH:MM format').optional(),
  recurrence: taskRecurrenceSchema.optional(),
});

// Schema for updating an existing task
export const updateTaskBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: taskCategorySchema.optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  dueDate: z.string().nullable().optional(),
  dueTime: z.string().regex(TIME_REGEX, 'Time must be in HH:MM format').nullable().optional(),
  recurrence: taskRecurrenceSchema.nullable().optional(),
  caregiverId: z.string().uuid('Invalid caregiver ID format').nullable().optional(),
});

// Schema for completing a task
export const completeTaskBodySchema = z.object({
  completedAt: z.string().datetime().optional(), // ISO timestamp
});

// Schema for task URL parameters
export const taskParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  taskId: z.string().uuid('Invalid task ID format'),
});

// Schema for task list query parameters
export const listTasksQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  seniorId: z.string().uuid().optional(),
  category: taskCategorySchema.optional(),
  fromDate: z.string().optional(), // ISO date YYYY-MM-DD
  toDate: z.string().optional(), // ISO date YYYY-MM-DD
});

// Schema for task reminder URL parameters
export const taskReminderParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  taskId: z.string().uuid('Invalid task ID format'),
  reminderId: z.string().uuid('Invalid reminder ID format'),
});

// Schema for creating a task reminder
export const createTaskReminderBodySchema = z.object({
  time: z.string().regex(TIME_REGEX, 'Time must be in HH:MM format (00:00 to 23:59)'),
  daysOfWeek: z.array(
    z.number().int().min(0).max(6)
  ).min(1, 'At least one day must be selected').refine(
    (days) => new Set(days).size === days.length,
    { message: 'Days of week must be unique' }
  ),
  enabled: z.boolean().optional().default(true),
});

// Schema for updating a task reminder
export const updateTaskReminderBodySchema = z.object({
  time: z.string().regex(TIME_REGEX, 'Time must be in HH:MM format (00:00 to 23:59)').optional(),
  daysOfWeek: z.array(
    z.number().int().min(0).max(6)
  ).min(1, 'At least one day must be selected').refine(
    (days) => new Set(days).size === days.length,
    { message: 'Days of week must be unique' }
  ).optional(),
  enabled: z.boolean().optional(),
});
