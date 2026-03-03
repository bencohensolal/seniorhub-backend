import { createHash } from 'node:crypto';
import type { HouseholdRole, Member } from '../../../domain/entities/Member.js';
import type { HouseholdInvitation } from '../../../domain/entities/Invitation.js';
import type { Medication, MedicationForm } from '../../../domain/entities/Medication.js';
import type { MedicationReminder } from '../../../domain/entities/MedicationReminder.js';
import type { Appointment, AppointmentType, AppointmentStatus, Recurrence } from '../../../domain/entities/Appointment.js';
import type { AppointmentReminder } from '../../../domain/entities/AppointmentReminder.js';
import type { AppointmentOccurrence, OccurrenceStatus, OccurrenceOverrides } from '../../../domain/entities/AppointmentOccurrence.js';
import type { Task, TaskCategory, TaskPriority, TaskStatus, TaskRecurrence } from '../../../domain/entities/Task.js';
import type { TaskReminder } from '../../../domain/entities/TaskReminder.js';

// Date and time helpers
export const nowIso = (): string => new Date().toISOString();

export const addHours = (isoDate: string, hours: number): string => {
  const date = new Date(isoDate);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

export const toIso = (value: string | Date): string => new Date(value).toISOString();

// Normalization helpers
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const normalizeName = (value: string): string => value.trim();

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

// Database row mappers
export const mapMember = (row: {
  id: string;
  household_id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: HouseholdRole;
  status: 'active' | 'pending';
  joined_at: string | Date;
  created_at: string | Date;
}): Member => ({
  id: row.id,
  householdId: row.household_id,
  userId: row.user_id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  status: row.status,
  joinedAt: toIso(row.joined_at),
  createdAt: toIso(row.created_at),
});

export const mapInvitation = (row: {
  id: string;
  household_id: string;
  household_name: string;
  inviter_user_id: string;
  invitee_email: string;
  invitee_first_name: string;
  invitee_last_name: string;
  assigned_role: HouseholdRole;
  token_hash: string;
  token_expires_at: string | Date;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  created_at: string | Date;
  accepted_at: string | Date | null;
}): HouseholdInvitation => ({
  id: row.id,
  householdId: row.household_id,
  householdName: row.household_name,
  inviterUserId: row.inviter_user_id,
  inviteeEmail: row.invitee_email,
  inviteeFirstName: row.invitee_first_name,
  inviteeLastName: row.invitee_last_name,
  assignedRole: row.assigned_role,
  tokenHash: row.token_hash,
  tokenExpiresAt: toIso(row.token_expires_at),
  status: row.status,
  createdAt: toIso(row.created_at),
  acceptedAt: row.accepted_at ? toIso(row.accepted_at) : null,
});

export const mapMedication = (row: {
  id: string;
  household_id: string;
  senior_id: string;
  name: string;
  dosage: string;
  form: MedicationForm;
  frequency: string;
  prescribed_by: string | null;
  prescription_date: string | Date | null;
  start_date: string | Date;
  end_date: string | Date | null;
  instructions: string | null;
  created_by_user_id: string;
  created_at: string | Date;
  updated_at: string | Date;
}): Medication => ({
  id: row.id,
  householdId: row.household_id,
  seniorId: row.senior_id,
  name: row.name,
  dosage: row.dosage,
  form: row.form,
  frequency: row.frequency,
  prescribedBy: row.prescribed_by,
  prescriptionDate: row.prescription_date ? toIso(row.prescription_date) : null,
  startDate: toIso(row.start_date),
  endDate: row.end_date ? toIso(row.end_date) : null,
  instructions: row.instructions,
  createdByUserId: row.created_by_user_id,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

export const mapReminder = (row: {
  id: string;
  medication_id: string;
  time: string;
  days_of_week: number[] | string; // May come as array or string representation
  enabled: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}): MedicationReminder => ({
  id: row.id,
  medicationId: row.medication_id,
  time: row.time,
  daysOfWeek: typeof row.days_of_week === 'string' ? JSON.parse(row.days_of_week) : row.days_of_week,
  enabled: row.enabled,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

export const mapAppointment = (row: {
  id: string;
  household_id: string;
  title: string;
  type: AppointmentType;
  date: string | Date;
  time: string;
  duration: number | null;
  senior_ids: string[] | string; // May come as array or JSON string
  caregiver_id: string | null;
  address: string | null;
  location_name: string | null;
  phone_number: string | null;
  description: string | null;
  professional_name: string | null;
  preparation: string | null;
  documents_to_take: string | null;
  transport_arrangement: string | null;
  recurrence: Recurrence | string | null; // May come as object or JSON string
  status: AppointmentStatus;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}): Appointment => ({
  id: row.id,
  householdId: row.household_id,
  title: row.title,
  type: row.type,
  date: toIso(row.date).split('T')[0] || toIso(row.date), // Extract YYYY-MM-DD from ISO string
  time: row.time,
  duration: row.duration,
  seniorIds: typeof row.senior_ids === 'string' ? JSON.parse(row.senior_ids) : row.senior_ids,
  caregiverId: row.caregiver_id,
  address: row.address,
  locationName: row.location_name,
  phoneNumber: row.phone_number,
  description: row.description,
  professionalName: row.professional_name,
  preparation: row.preparation,
  documentsToTake: row.documents_to_take,
  transportArrangement: row.transport_arrangement,
  recurrence: row.recurrence ? (typeof row.recurrence === 'string' ? JSON.parse(row.recurrence) : row.recurrence) : null,
  status: row.status,
  notes: row.notes,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

export const mapAppointmentReminder = (row: {
  id: string;
  appointment_id: string;
  trigger_before: number;
  custom_message: string | null;
  enabled: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}): AppointmentReminder => ({
  id: row.id,
  appointmentId: row.appointment_id,
  triggerBefore: row.trigger_before,
  customMessage: row.custom_message,
  enabled: row.enabled,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

export const mapOccurrence = (row: {
  id: string;
  recurring_appointment_id: string;
  household_id: string;
  occurrence_date: string | Date;
  occurrence_time: string;
  status: OccurrenceStatus;
  overrides: OccurrenceOverrides | string | null;
  created_at: string | Date;
  updated_at: string | Date;
}): AppointmentOccurrence => ({
  id: row.id,
  recurringAppointmentId: row.recurring_appointment_id,
  householdId: row.household_id,
  occurrenceDate: toIso(row.occurrence_date).split('T')[0] || toIso(row.occurrence_date),
  occurrenceTime: row.occurrence_time,
  status: row.status,
  overrides: row.overrides ? (typeof row.overrides === 'string' ? JSON.parse(row.overrides) : row.overrides) : null,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

export const mapTask = (row: {
  id: string;
  household_id: string;
  senior_id: string;
  caregiver_id: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | Date | null;
  due_time: string | null;
  recurrence: TaskRecurrence | string | null;
  completed_at: string | Date | null;
  completed_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  created_by: string;
}): Task => ({
  id: row.id,
  householdId: row.household_id,
  seniorId: row.senior_id,
  caregiverId: row.caregiver_id,
  title: row.title,
  description: row.description,
  category: row.category,
  priority: row.priority,
  status: row.status,
  dueDate: row.due_date ? (toIso(row.due_date).split('T')[0] || null) : null,
  dueTime: row.due_time,
  recurrence: row.recurrence ? (typeof row.recurrence === 'string' ? JSON.parse(row.recurrence) : row.recurrence) : null,
  completedAt: row.completed_at ? toIso(row.completed_at) : null,
  completedBy: row.completed_by,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
  createdBy: row.created_by,
});

export const mapTaskReminder = (row: {
  id: string;
  task_id: string;
  time: string;
  days_of_week: number[] | string;
  enabled: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}): TaskReminder => ({
  id: row.id,
  taskId: row.task_id,
  time: row.time,
  daysOfWeek: typeof row.days_of_week === 'string' ? JSON.parse(row.days_of_week) : row.days_of_week,
  enabled: row.enabled,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});
