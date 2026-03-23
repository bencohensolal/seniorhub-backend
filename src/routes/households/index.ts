import type { FastifyPluginAsync } from 'fastify';
import { AcceptInvitationUseCase } from '../../domain/usecases/invitations/AcceptInvitationUseCase.js';
import { CancelInvitationUseCase } from '../../domain/usecases/invitations/CancelInvitationUseCase.js';
import { CreateBulkInvitationsUseCase } from '../../domain/usecases/invitations/CreateBulkInvitationsUseCase.js';
import { CreateHouseholdUseCase } from '../../domain/usecases/households/CreateHouseholdUseCase.js';
import { EnsureHouseholdRoleUseCase } from '../../domain/usecases/households/EnsureHouseholdRoleUseCase.js';
import { GetHouseholdOverviewUseCase } from '../../domain/usecases/households/GetHouseholdOverviewUseCase.js';
import { LeaveHouseholdUseCase } from '../../domain/usecases/households/LeaveHouseholdUseCase.js';
import { ListHouseholdMembersUseCase } from '../../domain/usecases/households/ListHouseholdMembersUseCase.js';
import { ListHouseholdInvitationsUseCase } from '../../domain/usecases/invitations/ListHouseholdInvitationsUseCase.js';
import { ListPendingInvitationsUseCase } from '../../domain/usecases/invitations/ListPendingInvitationsUseCase.js';
import { ListUserHouseholdsUseCase } from '../../domain/usecases/households/ListUserHouseholdsUseCase.js';
import { RemoveHouseholdMemberUseCase } from '../../domain/usecases/households/RemoveHouseholdMemberUseCase.js';
import { ResendInvitationUseCase } from '../../domain/usecases/invitations/ResendInvitationUseCase.js';
import { ReactivateInvitationUseCase } from '../../domain/usecases/invitations/ReactivateInvitationUseCase.js';
import { ResolveInvitationUseCase } from '../../domain/usecases/invitations/ResolveInvitationUseCase.js';
import { UpdateHouseholdMemberRoleUseCase } from '../../domain/usecases/households/UpdateHouseholdMemberRoleUseCase.js';
import { AutoAcceptPendingInvitationsUseCase } from '../../domain/usecases/invitations/AutoAcceptPendingInvitationsUseCase.js';
import { createHouseholdRepository } from '../../data/repositories/createHouseholdRepository.js';
import { registerHouseholdRoutes } from './households/householdRoutes.js';
import { registerInvitationRoutes } from './invitations/invitationRoutes.js';
import { registerObservabilityRoutes } from './observabilityRoutes.js';
import { registerMedicationRoutes } from './medications/medicationRoutes.js';
import { registerReminderRoutes } from './medications/reminderRoutes.js';
import { ListHouseholdMedicationsUseCase } from '../../domain/usecases/medications/ListHouseholdMedicationsUseCase.js';
import { CreateMedicationUseCase } from '../../domain/usecases/medications/CreateMedicationUseCase.js';
import { UpdateMedicationUseCase } from '../../domain/usecases/medications/UpdateMedicationUseCase.js';
import { DeleteMedicationUseCase } from '../../domain/usecases/medications/DeleteMedicationUseCase.js';
import { LogMedicationIntakeUseCase } from '../../domain/usecases/medications/LogMedicationIntakeUseCase.js';
import { ListMedicationRemindersUseCase } from '../../domain/usecases/reminders/ListMedicationRemindersUseCase.js';
import { CreateReminderUseCase } from '../../domain/usecases/reminders/CreateReminderUseCase.js';
import { UpdateReminderUseCase } from '../../domain/usecases/reminders/UpdateReminderUseCase.js';
import { DeleteReminderUseCase } from '../../domain/usecases/reminders/DeleteReminderUseCase.js';
import { ListHouseholdAppointmentsUseCase } from '../../domain/usecases/appointments/ListHouseholdAppointmentsUseCase.js';
import { CreateAppointmentUseCase } from '../../domain/usecases/appointments/CreateAppointmentUseCase.js';
import { UpdateAppointmentUseCase } from '../../domain/usecases/appointments/UpdateAppointmentUseCase.js';
import { DeleteAppointmentUseCase } from '../../domain/usecases/appointments/DeleteAppointmentUseCase.js';
import { CreateAppointmentReminderUseCase } from '../../domain/usecases/appointments/CreateAppointmentReminderUseCase.js';
import { UpdateAppointmentReminderUseCase } from '../../domain/usecases/appointments/UpdateAppointmentReminderUseCase.js';
import { DeleteAppointmentReminderUseCase } from '../../domain/usecases/appointments/DeleteAppointmentReminderUseCase.js';
import { ListAppointmentOccurrencesUseCase } from '../../domain/usecases/appointments/ListAppointmentOccurrencesUseCase.js';
import { ListUpcomingAppointmentsUseCase } from '../../domain/usecases/appointments/ListUpcomingAppointmentsUseCase.js';
import { ModifyOccurrenceUseCase } from '../../domain/usecases/appointments/ModifyOccurrenceUseCase.js';
import { CancelOccurrenceUseCase } from '../../domain/usecases/appointments/CancelOccurrenceUseCase.js';
import { BatchModifyOccurrencesUseCase } from '../../domain/usecases/appointments/BatchModifyOccurrencesUseCase.js';
import { BatchCancelOccurrencesUseCase } from '../../domain/usecases/appointments/BatchCancelOccurrencesUseCase.js';
import { RestoreOccurrenceUseCase } from '../../domain/usecases/appointments/RestoreOccurrenceUseCase.js';
import { registerAppointmentRoutes } from './appointments/appointmentRoutes.js';
import { registerOccurrenceRoutes } from './appointments/occurrenceRoutes.js';
import { registerMemberRoutes } from './households/memberRoutes.js';
import { registerTaskRoutes } from './tasks/taskRoutes.js';
import { registerDisplayTabletRoutes } from './displayTablets/displayTabletRoutes.js';
import { registerTabletConfigRoutes } from './displayTablets/tabletConfigRoutes.js';
import { photoScreenRoutes } from './photoScreens/photoScreenRoutes.js';
import { HouseholdAccessValidator } from '../../domain/usecases/shared/HouseholdAccessValidator.js';
import { ListHouseholdTasksUseCase } from '../../domain/usecases/tasks/ListHouseholdTasksUseCase.js';
import { CreateTaskUseCase } from '../../domain/usecases/tasks/CreateTaskUseCase.js';
import { UpdateTaskUseCase } from '../../domain/usecases/tasks/UpdateTaskUseCase.js';
import { DeleteTaskUseCase } from '../../domain/usecases/tasks/DeleteTaskUseCase.js';
import { CompleteTaskUseCase } from '../../domain/usecases/tasks/CompleteTaskUseCase.js';
import { CreateTaskReminderUseCase } from '../../domain/usecases/tasks/CreateTaskReminderUseCase.js';
import { UpdateTaskReminderUseCase } from '../../domain/usecases/tasks/UpdateTaskReminderUseCase.js';
import { DeleteTaskReminderUseCase } from '../../domain/usecases/tasks/DeleteTaskReminderUseCase.js';
import { ListDocumentRootsUseCase } from '../../domain/usecases/documents/ListDocumentRootsUseCase.js';
import { ListFolderContentUseCase } from '../../domain/usecases/documents/ListFolderContentUseCase.js';
import { CreateFolderUseCase } from '../../domain/usecases/documents/CreateFolderUseCase.js';
import { UpdateFolderUseCase } from '../../domain/usecases/documents/UpdateFolderUseCase.js';
import { DeleteFolderUseCase } from '../../domain/usecases/documents/DeleteFolderUseCase.js';
import { CreateDocumentUseCase } from '../../domain/usecases/documents/CreateDocumentUseCase.js';
import { UpdateDocumentUseCase } from '../../domain/usecases/documents/UpdateDocumentUseCase.js';
import { DeleteDocumentUseCase } from '../../domain/usecases/documents/DeleteDocumentUseCase.js';
import { SearchDocumentsUseCase } from '../../domain/usecases/documents/SearchDocumentsUseCase.js';
import { MoveToTrashUseCase } from '../../domain/usecases/documents/MoveToTrashUseCase.js';
import { RestoreFromTrashUseCase } from '../../domain/usecases/documents/RestoreFromTrashUseCase.js';
import { PurgeExpiredTrashUseCase } from '../../domain/usecases/documents/PurgeExpiredTrashUseCase.js';
import { GetDocumentDownloadUrlUseCase } from '../../domain/usecases/documents/GetDocumentDownloadUrlUseCase.js';
import { PermanentlyDeleteFromTrashUseCase } from '../../domain/usecases/documents/PermanentlyDeleteFromTrashUseCase.js';
import { GetStorageStatsUseCase } from '../../domain/usecases/documents/GetStorageStatsUseCase.js';
import { createStorageService } from '../../data/services/storage/createStorageService.js';
import { registerDocumentRoutes } from './documents/documentRoutes.js';
import { ListEmergencyContactsUseCase } from '../../domain/usecases/emergencyContacts/ListEmergencyContactsUseCase.js';
import { CreateEmergencyContactUseCase } from '../../domain/usecases/emergencyContacts/CreateEmergencyContactUseCase.js';
import { UpdateEmergencyContactUseCase } from '../../domain/usecases/emergencyContacts/UpdateEmergencyContactUseCase.js';
import { DeleteEmergencyContactUseCase } from '../../domain/usecases/emergencyContacts/DeleteEmergencyContactUseCase.js';
import { ReorderEmergencyContactsUseCase } from '../../domain/usecases/emergencyContacts/ReorderEmergencyContactsUseCase.js';
import { TriggerEmergencyAlertUseCase } from '../../domain/usecases/emergencyContacts/TriggerEmergencyAlertUseCase.js';
import { registerEmergencyContactRoutes } from './emergencyContacts/emergencyContactRoutes.js';
import { registerSeniorDeviceRoutes } from './seniorDevices/seniorDeviceRoutes.js';
import { expoPushService } from '../../services/ExpoPushService.js';
import { createSmsService } from '../../services/SmsService.js';

/**
 * Households plugin
 *
 * This plugin registers all household-related routes organized by domain:
 * - Household management (create, overview, list memberships)
 * - Invitation management (create, accept, cancel, resolve)
 * - Observability (metrics)
 */
export const householdsRoutes: FastifyPluginAsync = async (fastify) => {
  // Initialize repository
  const repository = createHouseholdRepository();

  // Initialize shared services
  const accessValidator = new HouseholdAccessValidator(repository);

  // Initialize use cases
  const useCases = {
    getHouseholdOverviewUseCase: new GetHouseholdOverviewUseCase(repository),
    createHouseholdUseCase: new CreateHouseholdUseCase(repository),
    listUserHouseholdsUseCase: new ListUserHouseholdsUseCase(repository),
    listHouseholdMembersUseCase: new ListHouseholdMembersUseCase(repository),
    ensureHouseholdRoleUseCase: new EnsureHouseholdRoleUseCase(repository),
    createBulkInvitationsUseCase: new CreateBulkInvitationsUseCase(repository),
    listPendingInvitationsUseCase: new ListPendingInvitationsUseCase(repository),
    listHouseholdInvitationsUseCase: new ListHouseholdInvitationsUseCase(repository),
    resolveInvitationUseCase: new ResolveInvitationUseCase(repository),
    acceptInvitationUseCase: new AcceptInvitationUseCase(repository),
    cancelInvitationUseCase: new CancelInvitationUseCase(repository),
    resendInvitationUseCase: new ResendInvitationUseCase(repository),
    reactivateInvitationUseCase: new ReactivateInvitationUseCase(repository),
    autoAcceptPendingInvitationsUseCase: new AutoAcceptPendingInvitationsUseCase(repository),
    removeHouseholdMemberUseCase: new RemoveHouseholdMemberUseCase(repository),
    updateHouseholdMemberRoleUseCase: new UpdateHouseholdMemberRoleUseCase(repository),
    leaveHouseholdUseCase: new LeaveHouseholdUseCase(repository),
    listHouseholdMedicationsUseCase: new ListHouseholdMedicationsUseCase(repository),
    createMedicationUseCase: new CreateMedicationUseCase(repository),
    updateMedicationUseCase: new UpdateMedicationUseCase(repository),
    deleteMedicationUseCase: new DeleteMedicationUseCase(repository),
    logMedicationIntakeUseCase: new LogMedicationIntakeUseCase(repository),
    listMedicationRemindersUseCase: new ListMedicationRemindersUseCase(repository),
    createReminderUseCase: new CreateReminderUseCase(repository),
    updateReminderUseCase: new UpdateReminderUseCase(repository),
    deleteReminderUseCase: new DeleteReminderUseCase(repository),
    listHouseholdAppointmentsUseCase: new ListHouseholdAppointmentsUseCase(repository),
    createAppointmentUseCase: new CreateAppointmentUseCase(repository),
    updateAppointmentUseCase: new UpdateAppointmentUseCase(repository),
    deleteAppointmentUseCase: new DeleteAppointmentUseCase(repository),
    createAppointmentReminderUseCase: new CreateAppointmentReminderUseCase(repository),
    updateAppointmentReminderUseCase: new UpdateAppointmentReminderUseCase(repository),
    deleteAppointmentReminderUseCase: new DeleteAppointmentReminderUseCase(repository),
    listAppointmentOccurrencesUseCase: new ListAppointmentOccurrencesUseCase(repository, accessValidator),
    listUpcomingAppointmentsUseCase: new ListUpcomingAppointmentsUseCase(repository, accessValidator),
    modifyOccurrenceUseCase: new ModifyOccurrenceUseCase(repository, accessValidator),
    cancelOccurrenceUseCase: new CancelOccurrenceUseCase(repository, accessValidator),
    batchModifyOccurrencesUseCase: new BatchModifyOccurrencesUseCase(repository, accessValidator),
    batchCancelOccurrencesUseCase: new BatchCancelOccurrencesUseCase(repository, accessValidator),
    restoreOccurrenceUseCase: new RestoreOccurrenceUseCase(repository, accessValidator),
    listHouseholdTasksUseCase: new ListHouseholdTasksUseCase(repository),
    createTaskUseCase: new CreateTaskUseCase(repository),
    updateTaskUseCase: new UpdateTaskUseCase(repository),
    deleteTaskUseCase: new DeleteTaskUseCase(repository),
    completeTaskUseCase: new CompleteTaskUseCase(repository),
    createTaskReminderUseCase: new CreateTaskReminderUseCase(repository),
    updateTaskReminderUseCase: new UpdateTaskReminderUseCase(repository),
    deleteTaskReminderUseCase: new DeleteTaskReminderUseCase(repository),
    listDocumentRootsUseCase: new ListDocumentRootsUseCase(repository),
    listFolderContentUseCase: new ListFolderContentUseCase(repository),
    createFolderUseCase: new CreateFolderUseCase(repository),
    updateFolderUseCase: new UpdateFolderUseCase(repository),
    deleteFolderUseCase: new DeleteFolderUseCase(repository),
    createDocumentUseCase: new CreateDocumentUseCase(repository),
    updateDocumentUseCase: new UpdateDocumentUseCase(repository),
    deleteDocumentUseCase: new DeleteDocumentUseCase(repository),
    searchDocumentsUseCase: new SearchDocumentsUseCase(repository),
    moveToTrashUseCase: new MoveToTrashUseCase(repository),
    restoreFromTrashUseCase: new RestoreFromTrashUseCase(repository),
    purgeExpiredTrashUseCase: new PurgeExpiredTrashUseCase(repository),
    getDocumentDownloadUrlUseCase: new GetDocumentDownloadUrlUseCase(repository, createStorageService()),
    permanentlyDeleteFromTrashUseCase: new PermanentlyDeleteFromTrashUseCase(repository, createStorageService()),
    getStorageStatsUseCase: new GetStorageStatsUseCase(repository),
    listEmergencyContactsUseCase: new ListEmergencyContactsUseCase(repository),
    createEmergencyContactUseCase: new CreateEmergencyContactUseCase(repository),
    updateEmergencyContactUseCase: new UpdateEmergencyContactUseCase(repository),
    deleteEmergencyContactUseCase: new DeleteEmergencyContactUseCase(repository),
    reorderEmergencyContactsUseCase: new ReorderEmergencyContactsUseCase(repository),
    triggerEmergencyAlertUseCase: new TriggerEmergencyAlertUseCase(repository, expoPushService, createSmsService()),
  };

  // Register route modules
  registerHouseholdRoutes(fastify, repository, {
    createHouseholdUseCase: useCases.createHouseholdUseCase,
    getHouseholdOverviewUseCase: useCases.getHouseholdOverviewUseCase,
    listUserHouseholdsUseCase: useCases.listUserHouseholdsUseCase,
  });

  registerMemberRoutes(fastify, repository, {
    listHouseholdMembersUseCase: useCases.listHouseholdMembersUseCase,
    removeHouseholdMemberUseCase: useCases.removeHouseholdMemberUseCase,
    updateHouseholdMemberRoleUseCase: useCases.updateHouseholdMemberRoleUseCase,
    leaveHouseholdUseCase: useCases.leaveHouseholdUseCase,
  });

  registerInvitationRoutes(fastify, repository, {
    createBulkInvitationsUseCase: useCases.createBulkInvitationsUseCase,
    ensureHouseholdRoleUseCase: useCases.ensureHouseholdRoleUseCase,
    listPendingInvitationsUseCase: useCases.listPendingInvitationsUseCase,
    listHouseholdInvitationsUseCase: useCases.listHouseholdInvitationsUseCase,
    resolveInvitationUseCase: useCases.resolveInvitationUseCase,
    acceptInvitationUseCase: useCases.acceptInvitationUseCase,
    cancelInvitationUseCase: useCases.cancelInvitationUseCase,
    resendInvitationUseCase: useCases.resendInvitationUseCase,
    reactivateInvitationUseCase: useCases.reactivateInvitationUseCase,
    autoAcceptPendingInvitationsUseCase: useCases.autoAcceptPendingInvitationsUseCase,
  });

  registerObservabilityRoutes(fastify);

  registerMedicationRoutes(fastify, repository, {
    listHouseholdMedicationsUseCase: useCases.listHouseholdMedicationsUseCase,
    createMedicationUseCase: useCases.createMedicationUseCase,
    updateMedicationUseCase: useCases.updateMedicationUseCase,
    deleteMedicationUseCase: useCases.deleteMedicationUseCase,
    logMedicationIntakeUseCase: useCases.logMedicationIntakeUseCase,
  });

  registerReminderRoutes(fastify, repository, {
    listMedicationRemindersUseCase: useCases.listMedicationRemindersUseCase,
    createReminderUseCase: useCases.createReminderUseCase,
    updateReminderUseCase: useCases.updateReminderUseCase,
    deleteReminderUseCase: useCases.deleteReminderUseCase,
  });

  registerAppointmentRoutes(fastify, repository, {
    listHouseholdAppointmentsUseCase: useCases.listHouseholdAppointmentsUseCase,
    createAppointmentUseCase: useCases.createAppointmentUseCase,
    updateAppointmentUseCase: useCases.updateAppointmentUseCase,
    deleteAppointmentUseCase: useCases.deleteAppointmentUseCase,
    createAppointmentReminderUseCase: useCases.createAppointmentReminderUseCase,
    updateAppointmentReminderUseCase: useCases.updateAppointmentReminderUseCase,
    deleteAppointmentReminderUseCase: useCases.deleteAppointmentReminderUseCase,
    listUpcomingAppointmentsUseCase: useCases.listUpcomingAppointmentsUseCase,
  });

  registerOccurrenceRoutes(fastify, repository, {
    listAppointmentOccurrencesUseCase: useCases.listAppointmentOccurrencesUseCase,
    modifyOccurrenceUseCase: useCases.modifyOccurrenceUseCase,
    cancelOccurrenceUseCase: useCases.cancelOccurrenceUseCase,
    batchModifyOccurrencesUseCase: useCases.batchModifyOccurrencesUseCase,
    batchCancelOccurrencesUseCase: useCases.batchCancelOccurrencesUseCase,
    restoreOccurrenceUseCase: useCases.restoreOccurrenceUseCase,
  });

  registerTaskRoutes(fastify, repository, {
    listHouseholdTasksUseCase: useCases.listHouseholdTasksUseCase,
    createTaskUseCase: useCases.createTaskUseCase,
    updateTaskUseCase: useCases.updateTaskUseCase,
    deleteTaskUseCase: useCases.deleteTaskUseCase,
    completeTaskUseCase: useCases.completeTaskUseCase,
    createTaskReminderUseCase: useCases.createTaskReminderUseCase,
    updateTaskReminderUseCase: useCases.updateTaskReminderUseCase,
    deleteTaskReminderUseCase: useCases.deleteTaskReminderUseCase,
  });

  registerDisplayTabletRoutes(fastify, repository);
  registerTabletConfigRoutes(fastify, repository);

  registerDocumentRoutes(fastify, repository, {
    listDocumentRootsUseCase: useCases.listDocumentRootsUseCase,
    listFolderContentUseCase: useCases.listFolderContentUseCase,
    createFolderUseCase: useCases.createFolderUseCase,
    updateFolderUseCase: useCases.updateFolderUseCase,
    deleteFolderUseCase: useCases.deleteFolderUseCase,
    createDocumentUseCase: useCases.createDocumentUseCase,
    updateDocumentUseCase: useCases.updateDocumentUseCase,
    deleteDocumentUseCase: useCases.deleteDocumentUseCase,
    searchDocumentsUseCase: useCases.searchDocumentsUseCase,
    moveToTrashUseCase: useCases.moveToTrashUseCase,
    restoreFromTrashUseCase: useCases.restoreFromTrashUseCase,
    purgeExpiredTrashUseCase: useCases.purgeExpiredTrashUseCase,
    permanentlyDeleteFromTrashUseCase: useCases.permanentlyDeleteFromTrashUseCase,
    getStorageStatsUseCase: useCases.getStorageStatsUseCase,
    getDocumentDownloadUrlUseCase: useCases.getDocumentDownloadUrlUseCase,
  });

  registerEmergencyContactRoutes(fastify, repository, {
    listEmergencyContactsUseCase: useCases.listEmergencyContactsUseCase,
    createEmergencyContactUseCase: useCases.createEmergencyContactUseCase,
    updateEmergencyContactUseCase: useCases.updateEmergencyContactUseCase,
    deleteEmergencyContactUseCase: useCases.deleteEmergencyContactUseCase,
    reorderEmergencyContactsUseCase: useCases.reorderEmergencyContactsUseCase,
    triggerEmergencyAlertUseCase: useCases.triggerEmergencyAlertUseCase,
  });

  registerSeniorDeviceRoutes(fastify, repository);

  // Register photo screen routes with v1 prefix
  await fastify.register(photoScreenRoutes, { prefix: '/v1' });
};
