import { createHash } from 'node:crypto';
import type { AuthProvider, HouseholdRole, Member } from '../../../domain/entities/Member.js';
import type { HouseholdInvitation } from '../../../domain/entities/Invitation.js';
import type { Medication, MedicationForm } from '../../../domain/entities/Medication.js';
import type { MedicationReminder } from '../../../domain/entities/MedicationReminder.js';
import type { Appointment, AppointmentType, AppointmentStatus, Recurrence } from '../../../domain/entities/Appointment.js';
import type { AppointmentReminder } from '../../../domain/entities/AppointmentReminder.js';
import type { AppointmentOccurrence, OccurrenceStatus, OccurrenceOverrides } from '../../../domain/entities/AppointmentOccurrence.js';
import type { Task, TaskCategory, TaskPriority, TaskStatus, TaskRecurrence } from '../../../domain/entities/Task.js';
import type { TaskReminder } from '../../../domain/entities/TaskReminder.js';
import type { DisplayTablet, DisplayTabletStatus } from '../../../domain/entities/DisplayTablet.js';
import type { TabletDisplayConfig } from '../../../domain/entities/TabletDisplayConfig.js';
import type { Document } from '../../../domain/entities/Document.js';
import type { DocumentFolderWithCounts, DocumentFolderType, SystemRootType } from '../../../domain/entities/DocumentFolder.js';
import type { MedicationLog } from '../../../domain/entities/MedicationLog.js';
import type { SeniorDevice, SeniorDeviceStatus } from '../../../domain/entities/SeniorDevice.js';

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
  email: string | null;
  first_name: string;
  last_name: string;
  role: HouseholdRole;
  status: 'active' | 'pending';
  joined_at: string | Date;
  created_at: string | Date;
  auth_provider?: string;
  phone_number?: string | null;
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
  authProvider: (row.auth_provider as AuthProvider) ?? 'google',
  phoneNumber: row.phone_number ?? null,
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
  reactivation_count: number;
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
  reactivationCount: row.reactivation_count,
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
  duration: number | null;
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
  duration: row.duration,
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
  time: string | null;
  days_of_week: number[] | string | null;
  trigger_before: number | null;
  custom_message: string | null;
  enabled: boolean;
  created_at: string | Date;
  updated_at: string | Date;
}): TaskReminder => ({
  id: row.id,
  taskId: row.task_id,
  time: row.time,
  daysOfWeek: row.days_of_week ? (typeof row.days_of_week === 'string' ? JSON.parse(row.days_of_week) : row.days_of_week) : null,
  triggerBefore: row.trigger_before,
  customMessage: row.custom_message,
  enabled: row.enabled,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

export const mapDisplayTablet = (row: {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  token_hash: string;
  config: TabletDisplayConfig | null;
  created_at: string | Date;
  created_by: string;
  last_active_at: string | Date | null;
  revoked_at: string | Date | null;
  revoked_by: string | null;
  status: DisplayTabletStatus;
}): DisplayTablet => ({
  id: row.id,
  householdId: row.household_id,
  name: row.name,
  description: row.description,
  tokenHash: row.token_hash,
  config: row.config,
  createdAt: toIso(row.created_at),
  createdBy: row.created_by,
  lastActiveAt: row.last_active_at ? toIso(row.last_active_at) : null,
  revokedAt: row.revoked_at ? toIso(row.revoked_at) : null,
  revokedBy: row.revoked_by,
  status: row.status,
});

export const mapDocument = (row: {
  id: string;
  household_id: string;
  folder_id: string;
  senior_id: string | null;
  name: string;
  description: string | null;
  original_filename: string;
  storage_key: string;
  mime_type: string;
  file_size_bytes: number;
  extension: string;
  event_date: string | Date | null;
  category: string | null;
  tags: string[] | null;
  uploaded_by_user_id: string;
  uploaded_at: string | Date;
  updated_at: string | Date;
  deleted_at: string | Date | null;
  trashed_at?: string | Date | null;
  original_folder_id?: string | null;
}): Document => ({
  id: row.id,
  householdId: row.household_id,
  folderId: row.folder_id,
  seniorId: row.senior_id,
  name: row.name,
  description: row.description,
  originalFilename: row.original_filename,
  storageKey: row.storage_key,
  mimeType: row.mime_type,
  fileSizeBytes: row.file_size_bytes,
  extension: row.extension,
  eventDate: row.event_date ? (toIso(row.event_date).split('T')[0] ?? null) : null,
  category: row.category,
  tags: row.tags ?? [],
  uploadedByUserId: row.uploaded_by_user_id,
  uploadedAt: toIso(row.uploaded_at),
  updatedAt: toIso(row.updated_at),
  deletedAt: row.deleted_at ? toIso(row.deleted_at) : null,
  trashedAt: row.trashed_at ? toIso(row.trashed_at) : null,
  originalFolderId: row.original_folder_id ?? null,
});

export function mapMedicationLog(row: {
  id: string;
  medication_id: string;
  household_id: string;
  scheduled_date: string | Date;
  scheduled_time?: string | null;
  taken_at: string | Date;
  taken_by_user_id?: string | null;
  note?: string | null;
  created_at: string | Date;
}): MedicationLog {
  return {
    id: row.id,
    medicationId: row.medication_id,
    householdId: row.household_id,
    scheduledDate: typeof row.scheduled_date === 'string'
      ? row.scheduled_date.slice(0, 10)
      : row.scheduled_date.toISOString().slice(0, 10),
    takenAt: toIso(row.taken_at),
    createdAt: toIso(row.created_at),
    ...(row.scheduled_time != null && { scheduledTime: row.scheduled_time }),
    ...(row.taken_by_user_id != null && { takenByUserId: row.taken_by_user_id }),
    ...(row.note != null && { note: row.note }),
  };
}

export const mapDocumentFolder = (row: {
  id: string;
  household_id: string;
  parent_folder_id: string | null;
  senior_id: string | null;
  name: string;
  description: string | null;
  type: 'system_root' | 'senior_folder' | 'user_folder';
  system_root_type: 'medical' | 'administrative' | 'trash' | null;
  created_by_user_id: string;
  created_at: string | Date;
  updated_at: string | Date;
  deleted_at: string | Date | null;
  trashed_at?: string | Date | null;
  original_parent_folder_id?: string | null;
  document_count?: number | string | null;
  folder_count?: number | string | null;
}): DocumentFolderWithCounts => {
  return {
    id: row.id,
    householdId: row.household_id,
    parentFolderId: row.parent_folder_id,
    seniorId: row.senior_id,
    name: row.name,
    description: row.description,
    type: row.type,
    systemRootType: row.system_root_type,
    createdByUserId: row.created_by_user_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    deletedAt: row.deleted_at ? toIso(row.deleted_at) : null,
    trashedAt: row.trashed_at ? toIso(row.trashed_at) : null,
    originalParentFolderId: row.original_parent_folder_id ?? null,
    documentCount: Number(row.document_count ?? 0),
    folderCount: Number(row.folder_count ?? 0),
  };
};

export const mapSeniorDevice = (row: {
  id: string;
  household_id: string;
  member_id: string;
  name: string;
  token_hash: string;
  status: SeniorDeviceStatus;
  created_by: string;
  created_at: string | Date;
  last_active_at: string | Date | null;
  revoked_at: string | Date | null;
  revoked_by: string | null;
}): SeniorDevice => ({
  id: row.id,
  householdId: row.household_id,
  memberId: row.member_id,
  name: row.name,
  tokenHash: row.token_hash,
  status: row.status,
  createdBy: row.created_by,
  createdAt: toIso(row.created_at),
  lastActiveAt: row.last_active_at ? toIso(row.last_active_at) : null,
  revokedAt: row.revoked_at ? toIso(row.revoked_at) : null,
  revokedBy: row.revoked_by,
});
