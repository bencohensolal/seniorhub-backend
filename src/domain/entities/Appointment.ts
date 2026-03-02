import type { AppointmentReminder } from './AppointmentReminder.js';

export type AppointmentType =
  | 'doctor'
  | 'specialist'
  | 'dentist'
  | 'lab'
  | 'imaging'
  | 'therapy'
  | 'pharmacy'
  | 'hospital'
  | 'other';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'missed';

export type RecurrenceFrequency =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly';

export interface Recurrence {
  frequency: RecurrenceFrequency;
  interval: number; // e.g., 2 for "every 2 weeks"
  daysOfWeek?: number[]; // 0=Sunday, 6=Saturday, for weekly
  dayOfMonth?: number; // 1-31, for monthly
  endDate?: string; // ISO date
  occurrences?: number; // number of occurrences before stopping
}

export interface Appointment {
  id: string;
  householdId: string;
  title: string;
  type: AppointmentType;
  date: string; // ISO date string (YYYY-MM-DD)
  time: string; // HH:MM format
  duration: number | null; // minutes
  
  // Participants
  seniorIds: string[]; // Array of household member IDs
  caregiverId: string | null; // Single household member ID
  
  // Location
  address: string | null;
  locationName: string | null;
  phoneNumber: string | null;
  
  // Details
  description: string | null;
  professionalName: string | null;
  preparation: string | null;
  documentsToTake: string | null;
  transportArrangement: string | null;
  
  // Recurrence
  recurrence: Recurrence | null;
  
  // Status
  status: AppointmentStatus;
  notes: string | null;
  
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentWithReminders extends Appointment {
  reminders: AppointmentReminder[];
}

export interface CreateAppointmentInput {
  householdId: string;
  title: string;
  type: AppointmentType;
  date: string;
  time: string;
  duration?: number;
  seniorIds: string[]; // Required, min 1
  caregiverId?: string;
  address?: string;
  locationName?: string;
  phoneNumber?: string;
  description?: string;
  professionalName?: string;
  preparation?: string;
  documentsToTake?: string;
  transportArrangement?: string;
  recurrence?: Recurrence;
  status?: AppointmentStatus;
  notes?: string;
}

export interface UpdateAppointmentInput {
  title?: string;
  type?: AppointmentType;
  date?: string;
  time?: string;
  duration?: number | null;
  seniorIds?: string[];
  caregiverId?: string | null;
  address?: string | null;
  locationName?: string | null;
  phoneNumber?: string | null;
  description?: string | null;
  professionalName?: string | null;
  preparation?: string | null;
  documentsToTake?: string | null;
  transportArrangement?: string | null;
  recurrence?: Recurrence | null;
  status?: AppointmentStatus;
  notes?: string | null;
}
