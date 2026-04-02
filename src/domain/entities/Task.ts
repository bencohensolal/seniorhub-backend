import type { TaskReminder } from './TaskReminder.js';
import type { RecurrenceFrequency } from './Appointment.js';

export type TaskCategory =
  | 'hydration'
  | 'nutrition'
  | 'exercise'
  | 'social'
  | 'household'
  | 'wellbeing'
  | 'other';

export type TaskPriority = 'low' | 'normal' | 'high';

export type TaskStatus = 'pending' | 'completed' | 'cancelled';

export interface TaskRecurrence {
  frequency: RecurrenceFrequency;
  interval: number; // e.g., 1 for "every day", 2 for "every 2 weeks"
  daysOfWeek?: number[]; // 0=Sunday, 6=Saturday, for weekly
  dayOfMonth?: number; // 1-31, for monthly recurrences
  endDate?: string; // ISO date
  occurrences?: number; // number of occurrences before stopping
}

export interface Task {
  id: string;
  householdId: string;
  seniorIds: string[]; // household member IDs
  caregiverId: string | null; // household member ID

  // Basic information
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;

  // Scheduling
  dueDate: string | null; // ISO date string (YYYY-MM-DD)
  dueTime: string | null; // HH:MM format
  duration: number | null; // Duration in minutes

  // Recurrence
  recurrence: TaskRecurrence | null;

  // Confirmation
  requiresConfirmation: boolean;
  confirmationDelayMinutes: number | null;
  confirmedAt: string | null;
  confirmedBy: string | null;

  // Completion tracking
  completedAt: string | null; // ISO timestamp
  completedBy: string | null; // household member ID

  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy: string; // household member ID
}

export interface TaskWithReminders extends Task {
  reminders: TaskReminder[];
}

export interface CreateTaskInput {
  householdId: string;
  seniorIds: string[]; // Required: task must be assigned to at least one senior
  caregiverId?: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority?: TaskPriority;
  dueDate?: string;
  dueTime?: string;
  duration?: number; // Duration in minutes
  recurrence?: TaskRecurrence;
  requiresConfirmation?: boolean;
  confirmationDelayMinutes?: number;
  createdBy: string;
}

export interface UpdateTaskInput {
  seniorIds?: string[];
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  dueTime?: string | null;
  duration?: number | null;
  recurrence?: TaskRecurrence | null;
  caregiverId?: string | null;
  requiresConfirmation?: boolean;
  confirmationDelayMinutes?: number | null;
  completedAt?: string | null;
  completedBy?: string | null;
}

export interface CompleteTaskInput {
  completedAt?: string; // ISO timestamp, defaults to now if not provided
}
