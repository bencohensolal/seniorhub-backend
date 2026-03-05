/**
 * AppointmentOccurrence Entity
 * 
 * Represents a single occurrence of a recurring appointment.
 * Allows modification or cancellation of individual occurrences without affecting the entire series.
 */

export type OccurrenceStatus = 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';

/**
 * Overrides that can be applied to a specific occurrence
 */
export interface OccurrenceOverrides {
  title?: string;
  time?: string;
  duration?: number;
  locationName?: string;
  address?: string;
  phoneNumber?: string;
  professionalName?: string;
  description?: string;
  preparation?: string;
  documentsToTake?: string;
  transportArrangement?: string;
  notes?: string;
}

/**
 * Base AppointmentOccurrence entity
 */
export interface AppointmentOccurrence {
  id: string;
  recurringAppointmentId: string;
  householdId: string;
  occurrenceDate: string; // YYYY-MM-DD
  occurrenceTime: string; // HH:MM
  status: OccurrenceStatus;
  overrides: OccurrenceOverrides | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating an occurrence (usually for modification or cancellation)
 */
export interface CreateOccurrenceInput {
  recurringAppointmentId: string;
  householdId: string;
  occurrenceDate: string;
  occurrenceTime: string;
  status: OccurrenceStatus;
  overrides?: OccurrenceOverrides;
}

/**
 * Input for updating an occurrence
 */
export interface UpdateOccurrenceInput {
  status?: OccurrenceStatus;
  overrides?: OccurrenceOverrides;
}

/**
 * Generated occurrence with merged data from recurring appointment and overrides
 * This is what gets returned to the client
 */
export interface GeneratedOccurrence {
  id: string; // occurrence ID if exists, or generated from appointment+date
  recurringAppointmentId: string;
  householdId: string;
  
  // Date and time
  occurrenceDate: string;
  occurrenceTime: string;
  start: string; // ISO datetime string (computed from occurrenceDate + occurrenceTime)
  end: string | null; // ISO datetime string (computed from start + duration)
  
  // Status
  status: OccurrenceStatus;
  isModified: boolean; // true if this occurrence has overrides
  isCancelled: boolean; // true if status is 'cancelled'
  
  // Merged data (from recurring appointment + overrides)
  title: string;
  type: string;
  duration: number | null;
  seniorIds: string[];
  caregiverId: string | null;
  address: string | null;
  locationName: string | null;
  phoneNumber: string | null;
  description: string | null;
  professionalName: string | null;
  preparation: string | null;
  documentsToTake: string | null;
  transportArrangement: string | null;
  notes: string | null;
  
  // Reminders (inherited from recurring appointment)
  reminders: any[]; // AppointmentReminder[]
  
  createdAt: string;
  updatedAt: string;
}
