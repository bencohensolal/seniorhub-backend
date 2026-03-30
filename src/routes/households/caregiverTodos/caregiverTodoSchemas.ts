import { z } from 'zod';

export const caregiverTodoPrioritySchema = z.enum(['low', 'normal', 'high']);
export const caregiverTodoStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);

export const createCaregiverTodoBodySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  priority: caregiverTodoPrioritySchema.optional().default('normal'),
  assignedTo: z.string().uuid('Invalid member ID format').optional(),
  dueDate: z.string().optional(),
});

export const updateCaregiverTodoBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  priority: caregiverTodoPrioritySchema.optional(),
  status: caregiverTodoStatusSchema.optional(),
  assignedTo: z.string().uuid('Invalid member ID format').nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const caregiverTodoParamsSchema = z.object({
  householdId: z.string().uuid('Invalid household ID format'),
  todoId: z.string().uuid('Invalid todo ID format'),
});

export const listCaregiverTodosQuerySchema = z.object({
  status: caregiverTodoStatusSchema.optional(),
  assignedTo: z.string().uuid().optional(),
});

export const addCommentBodySchema = z.object({
  content: z.string().min(1).max(1000),
});
