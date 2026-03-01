// Domain entity for medication reminders with day-of-week scheduling

export interface MedicationReminder {
  id: string;
  medicationId: string;
  time: string; // HH:MM format (e.g., "08:00")
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  medicationId: string;
  time: string;
  daysOfWeek: number[];
  enabled?: boolean;
}

export interface UpdateReminderInput {
  time?: string;
  daysOfWeek?: number[];
  enabled?: boolean;
}
