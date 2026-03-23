import type { HouseholdOverview } from '../entities/Household.js';
import type { Member } from '../entities/Member.js';
import type { Household, AuthenticatedRequester } from '../entities/Household.js';
import type { AuditEventInput, HouseholdInvitation, InvitationDeliveryResult } from '../entities/Invitation.js';
import type { HouseholdRole } from '../entities/Member.js';
import type { Medication, CreateMedicationInput, UpdateMedicationInput } from '../entities/Medication.js';
import type { MedicationReminder, CreateReminderInput, UpdateReminderInput } from '../entities/MedicationReminder.js';
import type { Appointment, AppointmentWithReminders, CreateAppointmentInput, UpdateAppointmentInput } from '../entities/Appointment.js';
import type { AppointmentReminder, CreateAppointmentReminderInput, UpdateAppointmentReminderInput } from '../entities/AppointmentReminder.js';
import type { AppointmentOccurrence, CreateOccurrenceInput, UpdateOccurrenceInput } from '../entities/AppointmentOccurrence.js';
import type { Task, TaskWithReminders, CreateTaskInput, UpdateTaskInput, CompleteTaskInput } from '../entities/Task.js';
import type { TaskReminder, CreateTaskReminderInput, UpdateTaskReminderInput } from '../entities/TaskReminder.js';
import type { DisplayTablet, DisplayTabletWithToken, CreateDisplayTabletInput, UpdateDisplayTabletInput, DisplayTabletAuthInfo } from '../entities/DisplayTablet.js';
import type { TabletDisplayConfig } from '../entities/TabletDisplayConfig.js';
import type { PhotoScreen, PhotoScreenWithPhotos, Photo, CreatePhotoScreenInput, UpdatePhotoScreenInput, CreatePhotoInput, UpdatePhotoInput } from '../entities/PhotoScreen.js';
import type { PrivacySettings, UpdatePrivacySettingsInput } from '../entities/PrivacySettings.js';
import type { UserProfile, UpdateUserProfileInput } from '../entities/UserProfile.js';
import type { HouseholdSettings, UpdateHouseholdSettingsInput } from '../entities/HouseholdSettings.js';
import type { Document, CreateDocumentInput, UpdateDocumentInput } from '../entities/Document.js';
import type { DocumentFolder, DocumentFolderWithCounts, CreateDocumentFolderInput, UpdateDocumentFolderInput } from '../entities/DocumentFolder.js';
import type { MedicationLog, CreateMedicationLogInput } from '../entities/MedicationLog.js';
import type { EmergencyContact, CreateEmergencyContactInput, UpdateEmergencyContactInput } from '../entities/EmergencyContact.js';

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
  reactivateInvitation(input: {
    householdId: string;
    invitationId: string;
    requesterUserId: string;
  }): Promise<{
    id: string;
    inviteeFirstName: string;
    inviteeLastName: string;
    inviteeEmail: string;
    assignedRole: HouseholdRole;
    newToken: string;
    newExpiresAt: string;
    acceptLinkUrl: string;
    deepLinkUrl: string;
    fallbackUrl: string | null;
  }>;
  removeMember(memberId: string): Promise<void>;
  updateMemberRole(memberId: string, newRole: HouseholdRole): Promise<Member>;
  logAuditEvent(input: AuditEventInput): Promise<void>;

  // Medications
  listHouseholdMedications(householdId: string): Promise<Medication[]>;
  getMedicationById(medicationId: string, householdId: string): Promise<Medication | null>;
  createMedication(input: CreateMedicationInput): Promise<Medication>;
  updateMedication(medicationId: string, householdId: string, input: UpdateMedicationInput): Promise<Medication>;
  deleteMedication(medicationId: string, householdId: string): Promise<void>;

  // Medication Logs
  createMedicationLog(input: CreateMedicationLogInput): Promise<MedicationLog>;
  getMedicationLogs(householdId: string, date: string): Promise<MedicationLog[]>;

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

  // Appointment Occurrences
  getOccurrenceById(occurrenceId: string, householdId: string): Promise<AppointmentOccurrence | null>;
  getOccurrenceByDate(appointmentId: string, occurrenceDate: string, householdId: string): Promise<AppointmentOccurrence | null>;
  listOccurrences(appointmentId: string, householdId: string, fromDate?: string, toDate?: string): Promise<AppointmentOccurrence[]>;
  listAllHouseholdOccurrencesInRange(householdId: string, fromDate: string, toDate: string): Promise<AppointmentOccurrence[]>;
  createOccurrence(input: CreateOccurrenceInput): Promise<AppointmentOccurrence>;
  updateOccurrence(occurrenceId: string, householdId: string, input: UpdateOccurrenceInput): Promise<AppointmentOccurrence>;
  deleteOccurrence(occurrenceId: string, householdId: string): Promise<void>;

  // Tasks
  listHouseholdTasks(householdId: string, filters?: {
    status?: string;
    seniorId?: string;
    category?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<TaskWithReminders[]>;
  getTaskById(taskId: string, householdId: string): Promise<TaskWithReminders | null>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(taskId: string, householdId: string, input: UpdateTaskInput): Promise<Task>;
  deleteTask(taskId: string, householdId: string): Promise<void>;
  completeTask(taskId: string, householdId: string, input: CompleteTaskInput, completedBy: string): Promise<Task>;

  // Task Reminders
  listTaskReminders(taskId: string, householdId: string): Promise<TaskReminder[]>;
  getTaskReminderById(reminderId: string, taskId: string, householdId: string): Promise<TaskReminder | null>;
  createTaskReminder(input: CreateTaskReminderInput): Promise<TaskReminder>;
  updateTaskReminder(reminderId: string, taskId: string, householdId: string, input: UpdateTaskReminderInput): Promise<TaskReminder>;
  deleteTaskReminder(reminderId: string, taskId: string, householdId: string): Promise<void>;

  // Display Tablets
  listHouseholdDisplayTablets(householdId: string): Promise<DisplayTablet[]>;
  getDisplayTabletById(tabletId: string, householdId: string): Promise<DisplayTablet | null>;
  createDisplayTablet(input: CreateDisplayTabletInput): Promise<DisplayTabletWithToken>;
  updateDisplayTablet(tabletId: string, householdId: string, input: UpdateDisplayTabletInput): Promise<DisplayTablet>;
  revokeDisplayTablet(tabletId: string, householdId: string, revokedBy: string): Promise<void>;
  deleteDisplayTablet(tabletId: string, householdId: string): Promise<void>;
  regenerateDisplayTabletToken(tabletId: string, householdId: string): Promise<DisplayTabletWithToken>;
  authenticateDisplayTablet(
    tabletId: string,
    setupToken: string,
    refreshToken: string,
    refreshTokenExpiresAt: string,
  ): Promise<DisplayTabletAuthInfo | null>;
  refreshDisplayTabletSession(
    tabletId: string,
    refreshToken: string,
    nextRefreshToken: string,
    nextRefreshTokenExpiresAt: string,
  ): Promise<DisplayTabletAuthInfo | null>;
  countActiveDisplayTablets(householdId: string): Promise<number>;
  updateDisplayTabletConfig(tabletId: string, householdId: string, config: TabletDisplayConfig): Promise<DisplayTablet>;

  // Photo Screens
  listPhotoScreens(tabletId: string, householdId: string): Promise<PhotoScreenWithPhotos[]>;
  getPhotoScreenById(photoScreenId: string, tabletId: string, householdId: string): Promise<PhotoScreenWithPhotos | null>;
  createPhotoScreen(input: CreatePhotoScreenInput): Promise<PhotoScreen>;
  updatePhotoScreen(photoScreenId: string, tabletId: string, householdId: string, input: UpdatePhotoScreenInput): Promise<PhotoScreen>;
  deletePhotoScreen(photoScreenId: string, tabletId: string, householdId: string): Promise<void>;
  countPhotoScreens(tabletId: string, householdId: string): Promise<number>;

  // Photos
  listPhotos(photoScreenId: string, householdId: string): Promise<Photo[]>;
  getPhotoById(photoId: string, photoScreenId: string, householdId: string): Promise<Photo | null>;
  createPhoto(input: CreatePhotoInput): Promise<Photo>;
  updatePhoto(photoId: string, photoScreenId: string, householdId: string, input: UpdatePhotoInput): Promise<Photo>;
  deletePhoto(photoId: string, photoScreenId: string, householdId: string): Promise<void>;
  countPhotos(photoScreenId: string): Promise<number>;
  reorderPhotos(photoScreenId: string, householdId: string, photoOrders: Array<{ id: string; order: number }>): Promise<Photo[]>;

  // Privacy Settings
  getUserPrivacySettings(userId: string): Promise<PrivacySettings | null>;
  updateUserPrivacySettings(userId: string, input: UpdatePrivacySettingsInput): Promise<PrivacySettings>;
  getBulkPrivacySettings(userIds: string[]): Promise<Map<string, PrivacySettings>>;

  // User Profile
  getUserProfile(userId: string): Promise<UserProfile | null>;
  updateUserProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile>;

  // Documents
  getDocumentFolderById(folderId: string, householdId: string): Promise<DocumentFolder | null>;
  listDocumentFoldersByParent(householdId: string, parentFolderId: string | null): Promise<DocumentFolderWithCounts[]>;
  createDocumentFolder(input: CreateDocumentFolderInput): Promise<DocumentFolder>;
  updateDocumentFolder(folderId: string, householdId: string, input: UpdateDocumentFolderInput): Promise<DocumentFolder>;
  softDeleteDocumentFolder(folderId: string, householdId: string): Promise<void>;
  restoreDocumentFolder(folderId: string, householdId: string): Promise<void>;
  getSystemRootFolder(householdId: string, systemRootType: 'medical' | 'administrative' | 'trash'): Promise<DocumentFolderWithCounts | null>;
  moveDocumentFolderToTrash(folderId: string, householdId: string, trashFolderId: string): Promise<void>;
  moveDocumentToTrash(documentId: string, householdId: string, trashFolderId: string): Promise<void>;
  restoreDocumentFolderFromTrash(folderId: string, householdId: string): Promise<void>;
  restoreDocumentFromTrash(documentId: string, householdId: string): Promise<void>;
  purgeExpiredTrashItems(householdId: string, retentionDays: number): Promise<{ folders: number; documents: number }>;
  ensureSystemRootsForHousehold(householdId: string, userId: string): Promise<void>;
  ensureSeniorFoldersForHousehold(householdId: string, medicalRootId: string, userId: string): Promise<void>;
  listSeniorFolders(householdId: string): Promise<DocumentFolderWithCounts[]>;

  getDocumentById(documentId: string, householdId: string): Promise<Document | null>;
  listDocumentsByFolder(householdId: string, folderId: string): Promise<Document[]>;
  listDocumentsByFolderPaginated(householdId: string, folderId: string, limit: number, offset: number): Promise<{ documents: Document[]; hasMore: boolean }>;
  createDocument(input: CreateDocumentInput): Promise<Document>;
  updateDocument(documentId: string, householdId: string, input: UpdateDocumentInput): Promise<Document>;
  softDeleteDocument(documentId: string, householdId: string): Promise<void>;
  hardDeleteDocument(documentId: string, householdId: string): Promise<{ storageKey: string }>;
  hardDeleteDocumentFolder(folderId: string, householdId: string): Promise<{ storageKeys: string[] }>;
  restoreDocument(documentId: string, householdId: string): Promise<void>;
  searchDocumentsAndFolders(householdId: string, query: string, folderId?: string | null): Promise<{
    folders: DocumentFolder[];
    documents: Document[];
  }>;

  // Storage quota
  getStorageStats(householdId: string): Promise<{ usedBytes: number; quotaBytes: number }>;

  // Household settings
  getHouseholdSettings(householdId: string): Promise<HouseholdSettings>;
  updateHouseholdSettings(householdId: string, input: UpdateHouseholdSettingsInput): Promise<HouseholdSettings>;
  updateHouseholdName(householdId: string, name: string): Promise<Household>;

  // Emergency Contacts
  listEmergencyContacts(householdId: string): Promise<EmergencyContact[]>;
  getEmergencyContactById(contactId: string, householdId: string): Promise<EmergencyContact | null>;
  createEmergencyContact(input: CreateEmergencyContactInput): Promise<EmergencyContact>;
  updateEmergencyContact(contactId: string, householdId: string, input: UpdateEmergencyContactInput): Promise<EmergencyContact>;
  deleteEmergencyContact(contactId: string, householdId: string): Promise<void>;
  reorderEmergencyContacts(householdId: string, orderedIds: string[]): Promise<void>;
  getCaregiverPushTokens(householdId: string): Promise<string[]>;
}
