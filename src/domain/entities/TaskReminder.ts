// Domain entity for task reminders with day-of-week scheduling

export interface TaskReminder {
  id: string;
  taskId: string;
  time: string; // HH:MM format (e.g., "08:00")
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskReminderInput {
  taskId: string;
  time: string;
  daysOfWeek: number[];
  enabled?: boolean;
}

export interface UpdateTaskReminderInput {
  time?: string;
  daysOfWeek?: number[];
  enabled?: boolean;
}
