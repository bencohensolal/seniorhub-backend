import type { HouseholdOverview } from '../entities/Household.js';
import type { Member } from '../entities/Member.js';
import type { Household, AuthenticatedRequester } from '../entities/Household.js';
import type { AuditEventInput, HouseholdInvitation, InvitationDeliveryResult } from '../entities/Invitation.js';
import type { HouseholdRole } from '../entities/Member.js';
import type { Medication, CreateMedicationInput, UpdateMedicationInput } from '../entities/Medication.js';
import type { MedicationReminder, CreateReminderInput, UpdateReminderInput } from '../entities/MedicationReminder.js';
import type { Appointment, AppointmentWithReminders, CreateAppointmentInput, UpdateAppointmentInput } from '../entities/Appointment.js';
import type { AppointmentReminder, CreateAppointmentReminderInput, UpdateAppointmentReminderInput } from '../entities/AppointmentReminder.js';

export interface InvitationCandidate {
  firstName: string;
  lastName: string;
  email: string;
  role: HouseholdRole;
}

export interface BulkInvitationResult {
  acceptedCount: number;
  skippedDuplicates: number;
  perUserErrors: Array<{ email: string; reason: string }>;
  deliveries: InvitationDeliveryResult[];
}

export interface UserHouseholdMembership {
  householdId: string;
  householdName: string;
  myRole: HouseholdRole;
  joinedAt: string;
  memberCount: number;
}

export interface HouseholdRepository {
  getOverviewById(householdId: string): Promise<HouseholdOverview | null>;
  findMemberInHousehold(memberId: string, householdId: string): Promise<Member | null>;
  findMemberById(memberId: string): Promise<Member | null>;
  findActiveMemberByUserInHousehold(userId: string, householdId: string): Promise<Member | null>;
  listUserHouseholds(userId: string): Promise<UserHouseholdMembership[]>;
  listHouseholdMembers(householdId: string): Promise<Member[]>;
  createHousehold(name: string, requester: AuthenticatedRequester): Promise<Household>;
  createBulkInvitations(input: {
    householdId: string;
    inviterUserId: string;
    users: InvitationCandidate[];
  }): Promise<BulkInvitationResult>;
  listPendingInvitationsByEmail(email: string): Promise<HouseholdInvitation[]>;
  listHouseholdInvitations(householdId: string): Promise<HouseholdInvitation[]>;
  resolveInvitationByToken(token: string): Promise<HouseholdInvitation | null>;
  acceptInvitation(input: {
    requester: AuthenticatedRequester;
    token?: string;
    invitationId?: string;
  }): Promise<{ householdId: string; role: HouseholdRole }>;
  cancelInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<void>;
  resendInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<{ newToken: string; newExpiresAt: string; acceptLinkUrl: string; deepLinkUrl: string; fallbackUrl: string | null }>;
  removeMember(memberId: string): Promise<void>;
  updateMemberRole(memberId: string, newRole: HouseholdRole): Promise<Member>;
  logAuditEvent(input: AuditEventInput): Promise<void>;
  
  // Medications
  listHouseholdMedications(householdId: string): Promise<Medication[]>;
  getMedicationById(medicationId: string, householdId: string): Promise<Medication | null>;
  createMedication(input: CreateMedicationInput): Promise<Medication>;
  updateMedication(medicationId: string, householdId: string, input: UpdateMedicationInput): Promise<Medication>;
  deleteMedication(medicationId: string, householdId: string): Promise<void>;

  // Medication Reminders
  listMedicationReminders(medicationId: string, householdId: string): Promise<MedicationReminder[]>;
  getReminderById(reminderId: string, medicationId: string, householdId: string): Promise<MedicationReminder | null>;
  createReminder(input: CreateReminderInput): Promise<MedicationReminder>;
  updateReminder(reminderId: string, medicationId: string, householdId: string, input: UpdateReminderInput): Promise<MedicationReminder>;
  deleteReminder(reminderId: string, medicationId: string, householdId: string): Promise<void>;

  // Appointments
  listHouseholdAppointments(householdId: string): Promise<AppointmentWithReminders[]>;
  getAppointmentById(appointmentId: string, householdId: string): Promise<AppointmentWithReminders | null>;
  createAppointment(input: CreateAppointmentInput): Promise<Appointment>;
  updateAppointment(appointmentId: string, householdId: string, input: UpdateAppointmentInput): Promise<Appointment>;
  deleteAppointment(appointmentId: string, householdId: string): Promise<void>;

  // Appointment Reminders
  listAppointmentReminders(appointmentId: string, householdId: string): Promise<AppointmentReminder[]>;
  getAppointmentReminderById(reminderId: string, appointmentId: string, householdId: string): Promise<AppointmentReminder | null>;
  createAppointmentReminder(input: CreateAppointmentReminderInput): Promise<AppointmentReminder>;
  updateAppointmentReminder(reminderId: string, appointmentId: string, householdId: string, input: UpdateAppointmentReminderInput): Promise<AppointmentReminder>;
  deleteAppointmentReminder(reminderId: string, appointmentId: string, householdId: string): Promise<void>;
}
