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
import { ResolveInvitationUseCase } from '../../domain/usecases/invitations/ResolveInvitationUseCase.js';
import { UpdateHouseholdMemberRoleUseCase } from '../../domain/usecases/households/UpdateHouseholdMemberRoleUseCase.js';
import { AutoAcceptPendingInvitationsUseCase } from '../../domain/usecases/invitations/AutoAcceptPendingInvitationsUseCase.js';
import { createHouseholdRepository } from '../../data/repositories/createHouseholdRepository.js';
import { registerHouseholdRoutes } from './householdRoutes.js';
import { registerInvitationRoutes } from './invitationRoutes.js';
import { registerObservabilityRoutes } from './observabilityRoutes.js';
import { registerMedicationRoutes } from './medicationRoutes.js';
import { registerReminderRoutes } from './reminderRoutes.js';
import { ListHouseholdMedicationsUseCase } from '../../domain/usecases/medications/ListHouseholdMedicationsUseCase.js';
import { CreateMedicationUseCase } from '../../domain/usecases/medications/CreateMedicationUseCase.js';
import { UpdateMedicationUseCase } from '../../domain/usecases/medications/UpdateMedicationUseCase.js';
import { DeleteMedicationUseCase } from '../../domain/usecases/medications/DeleteMedicationUseCase.js';
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
import { ModifyOccurrenceUseCase } from '../../domain/usecases/appointments/ModifyOccurrenceUseCase.js';
import { CancelOccurrenceUseCase } from '../../domain/usecases/appointments/CancelOccurrenceUseCase.js';
import { registerAppointmentRoutes } from './appointmentRoutes.js';
import { HouseholdAccessValidator } from '../../domain/usecases/shared/HouseholdAccessValidator.js';

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
    autoAcceptPendingInvitationsUseCase: new AutoAcceptPendingInvitationsUseCase(repository),
    removeHouseholdMemberUseCase: new RemoveHouseholdMemberUseCase(repository),
    updateHouseholdMemberRoleUseCase: new UpdateHouseholdMemberRoleUseCase(repository),
    leaveHouseholdUseCase: new LeaveHouseholdUseCase(repository),
    listHouseholdMedicationsUseCase: new ListHouseholdMedicationsUseCase(repository),
    createMedicationUseCase: new CreateMedicationUseCase(repository),
    updateMedicationUseCase: new UpdateMedicationUseCase(repository),
    deleteMedicationUseCase: new DeleteMedicationUseCase(repository),
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
    modifyOccurrenceUseCase: new ModifyOccurrenceUseCase(repository, accessValidator),
    cancelOccurrenceUseCase: new CancelOccurrenceUseCase(repository, accessValidator),
  };

  // Register route modules
  registerHouseholdRoutes(fastify, {
    createHouseholdUseCase: useCases.createHouseholdUseCase,
    getHouseholdOverviewUseCase: useCases.getHouseholdOverviewUseCase,
    listUserHouseholdsUseCase: useCases.listUserHouseholdsUseCase,
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
    autoAcceptPendingInvitationsUseCase: useCases.autoAcceptPendingInvitationsUseCase,
  });

  registerObservabilityRoutes(fastify);

  registerMedicationRoutes(fastify, {
    listHouseholdMedicationsUseCase: useCases.listHouseholdMedicationsUseCase,
    createMedicationUseCase: useCases.createMedicationUseCase,
    updateMedicationUseCase: useCases.updateMedicationUseCase,
    deleteMedicationUseCase: useCases.deleteMedicationUseCase,
  });

  registerReminderRoutes(fastify, {
    listMedicationRemindersUseCase: useCases.listMedicationRemindersUseCase,
    createReminderUseCase: useCases.createReminderUseCase,
    updateReminderUseCase: useCases.updateReminderUseCase,
    deleteReminderUseCase: useCases.deleteReminderUseCase,
  });

  registerAppointmentRoutes(fastify, {
    listHouseholdAppointmentsUseCase: useCases.listHouseholdAppointmentsUseCase,
    createAppointmentUseCase: useCases.createAppointmentUseCase,
    updateAppointmentUseCase: useCases.updateAppointmentUseCase,
    deleteAppointmentUseCase: useCases.deleteAppointmentUseCase,
    createAppointmentReminderUseCase: useCases.createAppointmentReminderUseCase,
    updateAppointmentReminderUseCase: useCases.updateAppointmentReminderUseCase,
    deleteAppointmentReminderUseCase: useCases.deleteAppointmentReminderUseCase,
    listAppointmentOccurrencesUseCase: useCases.listAppointmentOccurrencesUseCase,
    modifyOccurrenceUseCase: useCases.modifyOccurrenceUseCase,
    cancelOccurrenceUseCase: useCases.cancelOccurrenceUseCase,
  });
};
