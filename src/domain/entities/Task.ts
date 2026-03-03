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
  endDate?: string; // ISO date
  occurrences?: number; // number of occurrences before stopping
}

export interface Task {
  id: string;
  householdId: string;
  seniorId: string; // household member ID
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
  
  // Recurrence
  recurrence: TaskRecurrence | null;
  
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
  seniorId: string; // Required: task must be assigned to a senior
  caregiverId?: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority?: TaskPriority;
  dueDate?: string;
  dueTime?: string;
  recurrence?: TaskRecurrence;
  createdBy: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  dueDate?: string | null;
  dueTime?: string | null;
  recurrence?: TaskRecurrence | null;
  caregiverId?: string | null;
}

export interface CompleteTaskInput {
  completedAt?: string; // ISO timestamp, defaults to now if not provided
}
