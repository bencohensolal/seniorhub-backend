import type { FastifyPluginAsync } from 'fastify';
import { AcceptInvitationUseCase } from '../../domain/usecases/AcceptInvitationUseCase.js';
import { CancelInvitationUseCase } from '../../domain/usecases/CancelInvitationUseCase.js';
import { CreateBulkInvitationsUseCase } from '../../domain/usecases/CreateBulkInvitationsUseCase.js';
import { CreateHouseholdUseCase } from '../../domain/usecases/CreateHouseholdUseCase.js';
import { EnsureHouseholdRoleUseCase } from '../../domain/usecases/EnsureHouseholdRoleUseCase.js';
import { GetHouseholdOverviewUseCase } from '../../domain/usecases/GetHouseholdOverviewUseCase.js';
import { ListHouseholdMembersUseCase } from '../../domain/usecases/ListHouseholdMembersUseCase.js';
import { ListPendingInvitationsUseCase } from '../../domain/usecases/ListPendingInvitationsUseCase.js';
import { ListUserHouseholdsUseCase } from '../../domain/usecases/ListUserHouseholdsUseCase.js';
import { ResolveInvitationUseCase } from '../../domain/usecases/ResolveInvitationUseCase.js';
import { createHouseholdRepository } from '../../data/repositories/createHouseholdRepository.js';
import { registerHouseholdRoutes } from './householdRoutes.js';
import { registerInvitationRoutes } from './invitationRoutes.js';
import { registerObservabilityRoutes } from './observabilityRoutes.js';

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

  // Initialize use cases
  const useCases = {
    getHouseholdOverviewUseCase: new GetHouseholdOverviewUseCase(repository),
    createHouseholdUseCase: new CreateHouseholdUseCase(repository),
    listUserHouseholdsUseCase: new ListUserHouseholdsUseCase(repository),
    listHouseholdMembersUseCase: new ListHouseholdMembersUseCase(repository),
    ensureHouseholdRoleUseCase: new EnsureHouseholdRoleUseCase(repository),
    createBulkInvitationsUseCase: new CreateBulkInvitationsUseCase(repository),
    listPendingInvitationsUseCase: new ListPendingInvitationsUseCase(repository),
    resolveInvitationUseCase: new ResolveInvitationUseCase(repository),
    acceptInvitationUseCase: new AcceptInvitationUseCase(repository),
    cancelInvitationUseCase: new CancelInvitationUseCase(repository),
  };

  // Register route modules
  registerHouseholdRoutes(fastify, {
    createHouseholdUseCase: useCases.createHouseholdUseCase,
    getHouseholdOverviewUseCase: useCases.getHouseholdOverviewUseCase,
    listUserHouseholdsUseCase: useCases.listUserHouseholdsUseCase,
    listHouseholdMembersUseCase: useCases.listHouseholdMembersUseCase,
  });

  registerInvitationRoutes(fastify, repository, {
    createBulkInvitationsUseCase: useCases.createBulkInvitationsUseCase,
    ensureHouseholdRoleUseCase: useCases.ensureHouseholdRoleUseCase,
    listPendingInvitationsUseCase: useCases.listPendingInvitationsUseCase,
    resolveInvitationUseCase: useCases.resolveInvitationUseCase,
    acceptInvitationUseCase: useCases.acceptInvitationUseCase,
    cancelInvitationUseCase: useCases.cancelInvitationUseCase,
  });

  registerObservabilityRoutes(fastify);
};
