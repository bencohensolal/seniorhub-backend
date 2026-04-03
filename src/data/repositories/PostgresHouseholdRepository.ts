import type { Pool } from 'pg';
import type { HouseholdRepository } from '../../domain/repositories/HouseholdRepository.js';
import type { AuthenticatedRequester, Household, HouseholdOverview } from '../../domain/entities/Household.js';
import type { HouseholdInvitation } from '../../domain/entities/Invitation.js';
import type { AuditEventInput, ListAuditEventsParams, ListAuditEventsResult } from '../../domain/entities/AuditEvent.js';
import type { HouseholdRole, Member } from '../../domain/entities/Member.js';
import type { Appointment, AppointmentWithReminders, CreateAppointmentInput, UpdateAppointmentInput } from '../../domain/entities/Appointment.js';
import type { AppointmentReminder, CreateAppointmentReminderInput, UpdateAppointmentReminderInput } from '../../domain/entities/AppointmentReminder.js';
import type { AppointmentOccurrence, CreateOccurrenceInput, UpdateOccurrenceInput } from '../../domain/entities/AppointmentOccurrence.js';
import type { Task, TaskWithReminders, CreateTaskInput, UpdateTaskInput, CompleteTaskInput } from '../../domain/entities/Task.js';
import type { TaskReminder, CreateTaskReminderInput, UpdateTaskReminderInput } from '../../domain/entities/TaskReminder.js';
import type { CaregiverTodo, CaregiverTodoWithComments, CaregiverTodoComment, CreateCaregiverTodoInput, UpdateCaregiverTodoInput } from '../../domain/entities/CaregiverTodo.js';
import type { DisplayTablet, DisplayTabletWithToken, CreateDisplayTabletInput, UpdateDisplayTabletInput, DisplayTabletAuthInfo } from '../../domain/entities/DisplayTablet.js';
import type { TabletDisplayConfig } from '../../domain/entities/TabletDisplayConfig.js';
import type { CreatePhotoInput, CreatePhotoScreenInput, Photo, PhotoScreen, PhotoScreenWithPhotos, UpdatePhotoInput, UpdatePhotoScreenInput } from '../../domain/entities/PhotoScreen.js';
import type { TextScreen, CreateTextScreenInput, UpdateTextScreenInput } from '../../domain/entities/TextScreen.js';
import type { PrivacySettings, UpdatePrivacySettingsInput } from '../../domain/entities/PrivacySettings.js';
import type { UserProfile, UpdateUserProfileInput } from '../../domain/entities/UserProfile.js';
import type { HouseholdSettings, UpdateHouseholdSettingsInput } from '../../domain/entities/HouseholdSettings.js';
import type { Document, CreateDocumentInput, UpdateDocumentInput } from '../../domain/entities/Document.js';
import type { DocumentFolder, DocumentFolderWithCounts, CreateDocumentFolderInput, UpdateDocumentFolderInput } from '../../domain/entities/DocumentFolder.js';
import type { BulkInvitationResult, InvitationCandidate } from '../../domain/repositories/HouseholdRepository.js';
import { PostgresHouseholdCoreRepository } from './postgres/PostgresHouseholdCoreRepository.js';
import { PostgresAppointmentRepository } from './postgres/PostgresAppointmentRepository.js';
import { PostgresTaskRepository } from './postgres/PostgresTaskRepository.js';
import { PostgresDisplayTabletRepository } from './postgres/PostgresDisplayTabletRepository.js';
import { PostgresDocumentRepository } from './postgres/PostgresDocumentRepository.js';
import { PostgresPhotoScreenRepository } from './postgres/PostgresPhotoScreenRepository.js';
import { PostgresTextScreenRepository } from './postgres/PostgresTextScreenRepository.js';
import { PostgresPrivacyRepository } from './postgres/PostgresPrivacyRepository.js';
import { PostgresEmergencyContactRepository } from './postgres/PostgresEmergencyContactRepository.js';
import { PostgresSeniorDeviceRepository } from './postgres/PostgresSeniorDeviceRepository.js';
import { PostgresEmailAuthRepository } from './postgres/PostgresEmailAuthRepository.js';
import { PostgresCaregiverTodoRepository } from './postgres/PostgresCaregiverTodoRepository.js';
import { PostgresSubscriptionRepository } from './postgres/PostgresSubscriptionRepository.js';
import type { EmergencyContact, CreateEmergencyContactInput, UpdateEmergencyContactInput } from '../../domain/entities/EmergencyContact.js';
import type { SeniorDevice, SeniorDeviceWithToken, CreateSeniorDeviceInput, SeniorDeviceAuthInfo } from '../../domain/entities/SeniorDevice.js';
import type { EmailAccount, EmailAccountWithHash, EmailAuthSessionRecord } from '../../domain/entities/EmailAccount.js';
import type { Subscription, SubscriptionPlan, UpdateSubscriptionInput } from '../../domain/entities/Subscription.js';

export class PostgresHouseholdRepository implements HouseholdRepository {
  private readonly core: PostgresHouseholdCoreRepository;
  private readonly appointments: PostgresAppointmentRepository;
  private readonly tasks: PostgresTaskRepository;
  private readonly displayTablets: PostgresDisplayTabletRepository;
  private readonly documents: PostgresDocumentRepository;
  private readonly photoScreens: PostgresPhotoScreenRepository;
  private readonly textScreens: PostgresTextScreenRepository;
  private readonly privacy: PostgresPrivacyRepository;
  private readonly emergencyContacts: PostgresEmergencyContactRepository;
  private readonly seniorDevices: PostgresSeniorDeviceRepository;
  private readonly emailAuth: PostgresEmailAuthRepository;
  private readonly caregiverTodos: PostgresCaregiverTodoRepository;
  private readonly subscriptions: PostgresSubscriptionRepository;

  constructor(pool: Pool) {
    this.core = new PostgresHouseholdCoreRepository(pool);
    this.appointments = new PostgresAppointmentRepository(pool);
    this.tasks = new PostgresTaskRepository(pool);
    this.displayTablets = new PostgresDisplayTabletRepository(pool);
    this.documents = new PostgresDocumentRepository(pool);
    this.photoScreens = new PostgresPhotoScreenRepository(pool);
    this.textScreens = new PostgresTextScreenRepository(pool);
    this.privacy = new PostgresPrivacyRepository(pool);
    this.emergencyContacts = new PostgresEmergencyContactRepository(pool);
    this.seniorDevices = new PostgresSeniorDeviceRepository(pool);
    this.emailAuth = new PostgresEmailAuthRepository(pool);
    this.caregiverTodos = new PostgresCaregiverTodoRepository(pool);
    this.subscriptions = new PostgresSubscriptionRepository(pool);
  }

  // Core — households, members, settings, invitations
  getOverviewById = (householdId: string): Promise<HouseholdOverview | null> => this.core.getOverviewById(householdId);
  findMemberInHousehold = (memberId: string, householdId: string): Promise<Member | null> => this.core.findMemberInHousehold(memberId, householdId);
  findActiveMemberByUserInHousehold = (userId: string, householdId: string): Promise<Member | null> => this.core.findActiveMemberByUserInHousehold(userId, householdId);
  listUserHouseholds = (userId: string) => this.core.listUserHouseholds(userId);
  listHouseholdMembers = (householdId: string): Promise<Member[]> => this.core.listHouseholdMembers(householdId);
  getHouseholdSettings = (householdId: string): Promise<HouseholdSettings> => this.core.getHouseholdSettings(householdId);
  updateHouseholdSettings = (householdId: string, input: UpdateHouseholdSettingsInput): Promise<HouseholdSettings> => this.core.updateHouseholdSettings(householdId, input);
  createHousehold = (name: string, requester: AuthenticatedRequester): Promise<Household> => this.core.createHousehold(name, requester);
  updateHouseholdName = (householdId: string, name: string): Promise<Household> => this.core.updateHouseholdName(householdId, name);
  createBulkInvitations = (input: { householdId: string; inviterUserId: string; users: InvitationCandidate[] }): Promise<BulkInvitationResult> => this.core.createBulkInvitations(input);
  listPendingInvitationsByEmail = (email: string): Promise<HouseholdInvitation[]> => this.core.listPendingInvitationsByEmail(email);
  listHouseholdInvitations = (householdId: string): Promise<HouseholdInvitation[]> => this.core.listHouseholdInvitations(householdId);
  resolveInvitationByToken = (token: string): Promise<HouseholdInvitation | null> => this.core.resolveInvitationByToken(token);
  acceptInvitation = (input: { requester: AuthenticatedRequester; token?: string; invitationId?: string }): Promise<{ householdId: string; role: HouseholdRole }> => this.core.acceptInvitation(input);
  cancelInvitation = (input: { householdId: string; invitationId: string; requesterUserId: string }): Promise<void> => this.core.cancelInvitation(input);
  resendInvitation = (input: { householdId: string; invitationId: string; requesterUserId: string }): Promise<{ newToken: string; newExpiresAt: string; acceptLinkUrl: string; deepLinkUrl: string; fallbackUrl: string | null }> => this.core.resendInvitation(input);
  reactivateInvitation = (input: { householdId: string; invitationId: string; requesterUserId: string }): Promise<{ id: string; inviteeFirstName: string; inviteeLastName: string; inviteeEmail: string; assignedRole: HouseholdRole; newToken: string; newExpiresAt: string; acceptLinkUrl: string; deepLinkUrl: string; fallbackUrl: string | null }> => this.core.reactivateInvitation(input);
  logAuditEvent = (input: AuditEventInput): Promise<void> => this.core.logAuditEvent(input);
  listAuditEvents = (params: ListAuditEventsParams): Promise<ListAuditEventsResult> => this.core.listAuditEvents(params);
  findMemberById = (memberId: string): Promise<Member | null> => this.core.findMemberById(memberId);
  removeMember = (memberId: string): Promise<void> => this.core.removeMember(memberId);
  updateMemberRole = (memberId: string, newRole: HouseholdRole): Promise<Member> => this.core.updateMemberRole(memberId, newRole);

  // Appointments
  listHouseholdAppointments = (householdId: string): Promise<AppointmentWithReminders[]> => this.appointments.listHouseholdAppointments(householdId);
  getAppointmentById = (appointmentId: string, householdId: string): Promise<AppointmentWithReminders | null> => this.appointments.getAppointmentById(appointmentId, householdId);
  createAppointment = (input: CreateAppointmentInput): Promise<Appointment> => this.appointments.createAppointment(input);
  updateAppointment = (appointmentId: string, householdId: string, input: UpdateAppointmentInput): Promise<Appointment> => this.appointments.updateAppointment(appointmentId, householdId, input);
  deleteAppointment = (appointmentId: string, householdId: string): Promise<void> => this.appointments.deleteAppointment(appointmentId, householdId);

  // Appointment Reminders
  listAppointmentReminders = (appointmentId: string, householdId: string): Promise<AppointmentReminder[]> => this.appointments.listAppointmentReminders(appointmentId, householdId);
  getAppointmentReminderById = (reminderId: string, appointmentId: string, householdId: string): Promise<AppointmentReminder | null> => this.appointments.getAppointmentReminderById(reminderId, appointmentId, householdId);
  createAppointmentReminder = (input: CreateAppointmentReminderInput): Promise<AppointmentReminder> => this.appointments.createAppointmentReminder(input);
  updateAppointmentReminder = (reminderId: string, appointmentId: string, householdId: string, input: UpdateAppointmentReminderInput): Promise<AppointmentReminder> => this.appointments.updateAppointmentReminder(reminderId, appointmentId, householdId, input);
  deleteAppointmentReminder = (reminderId: string, appointmentId: string, householdId: string): Promise<void> => this.appointments.deleteAppointmentReminder(reminderId, appointmentId, householdId);

  // Appointment Occurrences
  getOccurrenceById = (occurrenceId: string, householdId: string): Promise<AppointmentOccurrence | null> => this.appointments.getOccurrenceById(occurrenceId, householdId);
  getOccurrenceByDate = (appointmentId: string, occurrenceDate: string, householdId: string): Promise<AppointmentOccurrence | null> => this.appointments.getOccurrenceByDate(appointmentId, occurrenceDate, householdId);
  listOccurrences = (appointmentId: string, householdId: string, fromDate?: string, toDate?: string): Promise<AppointmentOccurrence[]> => this.appointments.listOccurrences(appointmentId, householdId, fromDate, toDate);
  listAllHouseholdOccurrencesInRange = (householdId: string, fromDate: string, toDate: string): Promise<AppointmentOccurrence[]> => this.appointments.listAllHouseholdOccurrencesInRange(householdId, fromDate, toDate);
  createOccurrence = (input: CreateOccurrenceInput): Promise<AppointmentOccurrence> => this.appointments.createOccurrence(input);
  updateOccurrence = (occurrenceId: string, householdId: string, input: UpdateOccurrenceInput): Promise<AppointmentOccurrence> => this.appointments.updateOccurrence(occurrenceId, householdId, input);
  deleteOccurrence = (occurrenceId: string, householdId: string): Promise<void> => this.appointments.deleteOccurrence(occurrenceId, householdId);

  // Tasks
  listHouseholdTasks = (householdId: string, filters?: { status?: string; seniorId?: string; category?: string; fromDate?: string; toDate?: string }): Promise<TaskWithReminders[]> => this.tasks.listHouseholdTasks(householdId, filters);
  getTaskById = (taskId: string, householdId: string): Promise<TaskWithReminders | null> => this.tasks.getTaskById(taskId, householdId);
  createTask = (input: CreateTaskInput): Promise<Task> => this.tasks.createTask(input);
  updateTask = (taskId: string, householdId: string, input: UpdateTaskInput): Promise<Task> => this.tasks.updateTask(taskId, householdId, input);
  deleteTask = (taskId: string, householdId: string): Promise<void> => this.tasks.deleteTask(taskId, householdId);
  completeTask = (taskId: string, householdId: string, input: CompleteTaskInput, completedBy: string): Promise<Task> => this.tasks.completeTask(taskId, householdId, input, completedBy);
  confirmTask = (taskId: string, householdId: string, confirmedBy: string): Promise<Task> => this.tasks.confirmTask(taskId, householdId, confirmedBy);
  listUnconfirmedTasks = (): Promise<Task[]> => this.tasks.listUnconfirmedTasks();
  markConfirmationNotified = (taskIds: string[]): Promise<void> => this.tasks.markConfirmationNotified(taskIds);

  // Task Reminders
  listTaskReminders = (taskId: string, householdId: string): Promise<TaskReminder[]> => this.tasks.listTaskReminders(taskId, householdId);
  getTaskReminderById = (reminderId: string, taskId: string, householdId: string): Promise<TaskReminder | null> => this.tasks.getTaskReminderById(reminderId, taskId, householdId);
  createTaskReminder = (input: CreateTaskReminderInput): Promise<TaskReminder> => this.tasks.createTaskReminder(input);
  updateTaskReminder = (reminderId: string, taskId: string, householdId: string, input: UpdateTaskReminderInput): Promise<TaskReminder> => this.tasks.updateTaskReminder(reminderId, taskId, householdId, input);
  deleteTaskReminder = (reminderId: string, taskId: string, householdId: string): Promise<void> => this.tasks.deleteTaskReminder(reminderId, taskId, householdId);

  // Display Tablets
  listHouseholdDisplayTablets = (householdId: string): Promise<DisplayTablet[]> => this.displayTablets.listHouseholdDisplayTablets(householdId);
  getDisplayTabletById = (tabletId: string, householdId: string): Promise<DisplayTablet | null> => this.displayTablets.getDisplayTabletById(tabletId, householdId);
  createDisplayTablet = (input: CreateDisplayTabletInput): Promise<DisplayTabletWithToken> => this.displayTablets.createDisplayTablet(input);
  updateDisplayTablet = (tabletId: string, householdId: string, input: UpdateDisplayTabletInput): Promise<DisplayTablet> => this.displayTablets.updateDisplayTablet(tabletId, householdId, input);
  revokeDisplayTablet = (tabletId: string, householdId: string, revokedBy: string): Promise<void> => this.displayTablets.revokeDisplayTablet(tabletId, householdId, revokedBy);
  deleteDisplayTablet = (tabletId: string, householdId: string): Promise<void> => this.displayTablets.deleteDisplayTablet(tabletId, householdId);
  regenerateDisplayTabletToken = (tabletId: string, householdId: string): Promise<DisplayTabletWithToken> => this.displayTablets.regenerateDisplayTabletToken(tabletId, householdId);
  authenticateDisplayTablet = (tabletId: string, setupToken: string, refreshToken: string, refreshTokenExpiresAt: string): Promise<DisplayTabletAuthInfo | null> => this.displayTablets.authenticateDisplayTablet(tabletId, setupToken, refreshToken, refreshTokenExpiresAt);
  refreshDisplayTabletSession = (tabletId: string, refreshToken: string, nextRefreshToken: string, nextRefreshTokenExpiresAt: string): Promise<DisplayTabletAuthInfo | null> => this.displayTablets.refreshDisplayTabletSession(tabletId, refreshToken, nextRefreshToken, nextRefreshTokenExpiresAt);
  countActiveDisplayTablets = (householdId: string): Promise<number> => this.displayTablets.countActiveDisplayTablets(householdId);
  updateDisplayTabletConfig = (tabletId: string, householdId: string, config: TabletDisplayConfig): Promise<DisplayTablet> => this.displayTablets.updateDisplayTabletConfig(tabletId, householdId, config);

  // Photo Screens
  listPhotoScreens = (tabletId: string, householdId: string): Promise<PhotoScreenWithPhotos[]> => this.photoScreens.listPhotoScreens(tabletId, householdId);
  getPhotoScreenById = (photoScreenId: string, tabletId: string, householdId: string): Promise<PhotoScreenWithPhotos | null> => this.photoScreens.getPhotoScreenById(photoScreenId, tabletId, householdId);
  createPhotoScreen = (input: CreatePhotoScreenInput): Promise<PhotoScreen> => this.photoScreens.createPhotoScreen(input);
  updatePhotoScreen = (photoScreenId: string, tabletId: string, householdId: string, input: UpdatePhotoScreenInput): Promise<PhotoScreen> => this.photoScreens.updatePhotoScreen(photoScreenId, tabletId, householdId, input);
  deletePhotoScreen = (photoScreenId: string, tabletId: string, householdId: string): Promise<void> => this.photoScreens.deletePhotoScreen(photoScreenId, tabletId, householdId);
  countPhotoScreens = (tabletId: string, householdId: string): Promise<number> => this.photoScreens.countPhotoScreens(tabletId, householdId);

  // Photos
  listPhotos = (photoScreenId: string, householdId: string): Promise<Photo[]> => this.photoScreens.listPhotos(photoScreenId, householdId);
  getPhotoById = (photoId: string, photoScreenId: string, householdId: string): Promise<Photo | null> => this.photoScreens.getPhotoById(photoId, photoScreenId, householdId);
  createPhoto = (input: CreatePhotoInput): Promise<Photo> => this.photoScreens.createPhoto(input);
  updatePhoto = (photoId: string, photoScreenId: string, householdId: string, input: UpdatePhotoInput): Promise<Photo> => this.photoScreens.updatePhoto(photoId, photoScreenId, householdId, input);
  deletePhoto = (photoId: string, photoScreenId: string, householdId: string): Promise<void> => this.photoScreens.deletePhoto(photoId, photoScreenId, householdId);
  countPhotos = (photoScreenId: string): Promise<number> => this.photoScreens.countPhotos(photoScreenId);
  reorderPhotos = (photoScreenId: string, householdId: string, photoOrders: Array<{ id: string; order: number }>): Promise<Photo[]> => this.photoScreens.reorderPhotos(photoScreenId, householdId, photoOrders);

  // Text Screens
  listTextScreens = (tabletId: string, householdId: string): Promise<TextScreen[]> => this.textScreens.listTextScreens(tabletId, householdId);
  getTextScreenById = (textScreenId: string, tabletId: string, householdId: string): Promise<TextScreen | null> => this.textScreens.getTextScreenById(textScreenId, tabletId, householdId);
  createTextScreen = (input: CreateTextScreenInput): Promise<TextScreen> => this.textScreens.createTextScreen(input);
  updateTextScreen = (textScreenId: string, tabletId: string, householdId: string, input: UpdateTextScreenInput): Promise<TextScreen> => this.textScreens.updateTextScreen(textScreenId, tabletId, householdId, input);
  deleteTextScreen = (textScreenId: string, tabletId: string, householdId: string): Promise<void> => this.textScreens.deleteTextScreen(textScreenId, tabletId, householdId);
  countTextScreens = (tabletId: string, householdId: string): Promise<number> => this.textScreens.countTextScreens(tabletId, householdId);

  // Privacy Settings
  getUserPrivacySettings = (userId: string): Promise<PrivacySettings | null> => this.privacy.getUserPrivacySettings(userId);
  updateUserPrivacySettings = (userId: string, input: UpdatePrivacySettingsInput): Promise<PrivacySettings> => this.privacy.updateUserPrivacySettings(userId, input);
  getBulkPrivacySettings = (userIds: string[]): Promise<Map<string, PrivacySettings>> => this.privacy.getBulkPrivacySettings(userIds);

  // User Profile
  getUserProfile = (userId: string): Promise<UserProfile | null> => this.privacy.getUserProfile(userId);
  updateUserProfile = (userId: string, input: UpdateUserProfileInput): Promise<UserProfile> => this.privacy.updateUserProfile(userId, input);

  // Documents
  getDocumentFolderById = (folderId: string, householdId: string): Promise<DocumentFolder | null> => this.documents.getDocumentFolderById(folderId, householdId);
  listDocumentFoldersByParent = (householdId: string, parentFolderId: string | null): Promise<DocumentFolderWithCounts[]> => this.documents.listDocumentFoldersByParent(householdId, parentFolderId);
  createDocumentFolder = (input: CreateDocumentFolderInput): Promise<DocumentFolder> => this.documents.createDocumentFolder(input);
  updateDocumentFolder = (folderId: string, householdId: string, input: UpdateDocumentFolderInput): Promise<DocumentFolder> => this.documents.updateDocumentFolder(folderId, householdId, input);
  softDeleteDocumentFolder = (folderId: string, householdId: string): Promise<void> => this.documents.softDeleteDocumentFolder(folderId, householdId);
  restoreDocumentFolder = (folderId: string, householdId: string): Promise<void> => this.documents.restoreDocumentFolder(folderId, householdId);
  getSystemRootFolder = (householdId: string, systemRootType: 'personal' | 'administrative' | 'trash'): Promise<DocumentFolderWithCounts | null> => this.documents.getSystemRootFolder(householdId, systemRootType);
  ensureSystemRootsForHousehold = (householdId: string, userId: string): Promise<void> => this.documents.ensureSystemRootsForHousehold(householdId, userId);
  ensureSeniorFoldersForHousehold = (householdId: string, personalRootId: string, userId: string): Promise<void> => this.documents.ensureSeniorFoldersForHousehold(householdId, personalRootId, userId);
  listSeniorFolders = (householdId: string): Promise<DocumentFolderWithCounts[]> => this.documents.listSeniorFolders(householdId);
  moveDocumentFolderToTrash = (folderId: string, householdId: string, trashFolderId: string): Promise<void> => this.documents.moveDocumentFolderToTrash(folderId, householdId, trashFolderId);
  moveDocumentToTrash = (documentId: string, householdId: string, trashFolderId: string): Promise<void> => this.documents.moveDocumentToTrash(documentId, householdId, trashFolderId);
  restoreDocumentFolderFromTrash = (folderId: string, householdId: string): Promise<void> => this.documents.restoreDocumentFolderFromTrash(folderId, householdId);
  restoreDocumentFromTrash = (documentId: string, householdId: string): Promise<void> => this.documents.restoreDocumentFromTrash(documentId, householdId);
  purgeExpiredTrashItems = (householdId: string, retentionDays: number): Promise<{ folders: number; documents: number }> => this.documents.purgeExpiredTrashItems(householdId, retentionDays);

  getDocumentById = (documentId: string, householdId: string): Promise<Document | null> => this.documents.getDocumentById(documentId, householdId);
  listDocumentsByFolder = (householdId: string, folderId: string): Promise<Document[]> => this.documents.listDocumentsByFolder(householdId, folderId);
  createDocument = (input: CreateDocumentInput): Promise<Document> => this.documents.createDocument(input);
  updateDocument = (documentId: string, householdId: string, input: UpdateDocumentInput): Promise<Document> => this.documents.updateDocument(documentId, householdId, input);
  listDocumentsByFolderPaginated = (householdId: string, folderId: string, limit: number, offset: number): Promise<{ documents: Document[]; hasMore: boolean }> => this.documents.listDocumentsByFolderPaginated(householdId, folderId, limit, offset);
  softDeleteDocument = (documentId: string, householdId: string): Promise<void> => this.documents.softDeleteDocument(documentId, householdId);
  hardDeleteDocument = (documentId: string, householdId: string): Promise<{ storageKey: string }> => this.documents.hardDeleteDocument(documentId, householdId);
  hardDeleteDocumentFolder = (folderId: string, householdId: string): Promise<{ storageKeys: string[] }> => this.documents.hardDeleteDocumentFolder(folderId, householdId);
  restoreDocument = (documentId: string, householdId: string): Promise<void> => this.documents.restoreDocument(documentId, householdId);
  searchDocumentsAndFolders = (householdId: string, query: string, folderId?: string | null): Promise<{ folders: DocumentFolder[]; documents: Document[] }> => this.documents.searchDocumentsAndFolders(householdId, query, folderId);
  getStorageStats = (householdId: string): Promise<{ usedBytes: number; quotaBytes: number }> => this.documents.getStorageStats(householdId);

  // Emergency Contacts
  listEmergencyContacts = (householdId: string) => this.emergencyContacts.listEmergencyContacts(householdId);
  getEmergencyContactById = (contactId: string, householdId: string) => this.emergencyContacts.getEmergencyContactById(contactId, householdId);
  createEmergencyContact = (input: CreateEmergencyContactInput) => this.emergencyContacts.createEmergencyContact(input);
  updateEmergencyContact = (contactId: string, householdId: string, input: UpdateEmergencyContactInput) => this.emergencyContacts.updateEmergencyContact(contactId, householdId, input);
  deleteEmergencyContact = (contactId: string, householdId: string) => this.emergencyContacts.deleteEmergencyContact(contactId, householdId);
  reorderEmergencyContacts = (householdId: string, orderedIds: string[]) => this.emergencyContacts.reorderEmergencyContacts(householdId, orderedIds);
  getCaregiverPushTokens = (householdId: string) => this.emergencyContacts.getCaregiverPushTokens(householdId);

  // Senior Devices
  listHouseholdSeniorDevices = (householdId: string): Promise<SeniorDevice[]> => this.seniorDevices.listHouseholdSeniorDevices(householdId);
  getSeniorDeviceById = (deviceId: string, householdId: string): Promise<SeniorDevice | null> => this.seniorDevices.getSeniorDeviceById(deviceId, householdId);
  createSeniorDevice = (input: CreateSeniorDeviceInput): Promise<SeniorDeviceWithToken> => this.seniorDevices.createSeniorDevice(input);
  authenticateSeniorDevice = (deviceId: string, setupToken: string, refreshToken: string, refreshTokenExpiresAt: string): Promise<SeniorDeviceAuthInfo | null> => this.seniorDevices.authenticateSeniorDevice(deviceId, setupToken, refreshToken, refreshTokenExpiresAt);
  refreshSeniorDeviceSession = (deviceId: string, refreshToken: string, nextRefreshToken: string, nextRefreshTokenExpiresAt: string): Promise<SeniorDeviceAuthInfo | null> => this.seniorDevices.refreshSeniorDeviceSession(deviceId, refreshToken, nextRefreshToken, nextRefreshTokenExpiresAt);
  revokeSeniorDevice = (deviceId: string, householdId: string, revokedBy: string): Promise<void> => this.seniorDevices.revokeSeniorDevice(deviceId, householdId, revokedBy);
  revokeAllSeniorDevicesForMember = (memberId: string, householdId: string, revokedBy: string): Promise<void> => this.seniorDevices.revokeAllSeniorDevicesForMember(memberId, householdId, revokedBy);
  countActiveSeniorDevices = (householdId: string): Promise<number> => this.seniorDevices.countActiveSeniorDevices(householdId);
  archiveMember = (memberId: string, householdId: string): Promise<void> => this.core.archiveMember(memberId, householdId);
  restoreMember = (memberId: string, householdId: string): Promise<void> => this.core.restoreMember(memberId, householdId);
  listArchivedHouseholdMembers = (householdId: string) => this.core.listArchivedHouseholdMembers(householdId);

  // Caregiver Todos
  listCaregiverTodos = (householdId: string, filters?: { status?: string; assignedTo?: string }): Promise<CaregiverTodoWithComments[]> => this.caregiverTodos.listCaregiverTodos(householdId, filters);
  getCaregiverTodoById = (todoId: string, householdId: string): Promise<CaregiverTodoWithComments | null> => this.caregiverTodos.getCaregiverTodoById(todoId, householdId);
  createCaregiverTodo = (input: CreateCaregiverTodoInput): Promise<CaregiverTodo> => this.caregiverTodos.createCaregiverTodo(input);
  updateCaregiverTodo = (todoId: string, householdId: string, input: UpdateCaregiverTodoInput): Promise<CaregiverTodo> => this.caregiverTodos.updateCaregiverTodo(todoId, householdId, input);
  deleteCaregiverTodo = (todoId: string, householdId: string): Promise<void> => this.caregiverTodos.deleteCaregiverTodo(todoId, householdId);
  completeCaregiverTodo = (todoId: string, householdId: string, completedBy: string): Promise<CaregiverTodo> => this.caregiverTodos.completeCaregiverTodo(todoId, householdId, completedBy);
  nudgeCaregiverTodo = (todoId: string, householdId: string): Promise<CaregiverTodo> => this.caregiverTodos.nudgeCaregiverTodo(todoId, householdId);
  addCaregiverTodoComment = (input: { todoId: string; authorId: string; content: string }): Promise<CaregiverTodoComment> => this.caregiverTodos.addCaregiverTodoComment(input);

  // Subscriptions
  getActiveSubscription = (householdId: string): Promise<Subscription | null> => this.subscriptions.getActiveSubscription(householdId);
  getSubscriptionByRcAppUserId = (rcAppUserId: string): Promise<Subscription | null> => this.subscriptions.getByRcAppUserId(rcAppUserId);
  createSubscription = (householdId: string, plan: SubscriptionPlan): Promise<Subscription> => this.subscriptions.createSubscription(householdId, plan);
  updateSubscription = (subscriptionId: string, input: UpdateSubscriptionInput): Promise<Subscription> => this.subscriptions.updateSubscription(subscriptionId, input);
  ensureDefaultSubscription = (householdId: string): Promise<Subscription> => this.subscriptions.ensureDefaultSubscription(householdId);

  // Email auth
  findEmailAccountById = (id: string): Promise<EmailAccount | null> => this.emailAuth.findEmailAccountById(id);
  findEmailAccountByEmail = (email: string): Promise<EmailAccountWithHash | null> => this.emailAuth.findEmailAccountByEmail(email);
  findEmailAccountByUserId = (userId: string): Promise<EmailAccount | null> => this.emailAuth.findEmailAccountByUserId(userId);
  createEmailAccount = (input: { email: string; passwordHash: string; firstName: string; lastName: string }): Promise<EmailAccount> => this.emailAuth.createEmailAccount(input);
  createEmailAuthSession = (accountId: string): Promise<{ refreshToken: string }> => this.emailAuth.createEmailAuthSession(accountId);
  findEmailAuthSession = (refreshToken: string): Promise<EmailAuthSessionRecord | null> => this.emailAuth.findEmailAuthSession(refreshToken);
  rotateEmailAuthSession = (sessionId: string, accountId: string): Promise<{ refreshToken: string }> => this.emailAuth.rotateEmailAuthSession(sessionId, accountId);
  createProxyMember: HouseholdRepository['createProxyMember'] = (input) => this.seniorDevices.createProxyMember(input);
}
