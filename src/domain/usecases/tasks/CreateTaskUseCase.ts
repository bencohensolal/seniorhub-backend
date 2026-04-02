import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Task, CreateTaskInput, TaskCategory, TaskPriority, TaskRecurrence } from '../../entities/Task.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ValidationError } from '../../errors/index.js';
import { PlanLimitGuard } from '../shared/PlanLimitGuard.js';

/**
 * Creates a new task for a household.
 * Only caregivers can create tasks.
 */
export class CreateTaskUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
    this.planLimitGuard = new PlanLimitGuard(repository);
  }

  /**
   * @param input - Task creation data
   * @returns The newly created task
   * @throws {ForbiddenError} If requester is not a caregiver in the household
   * @throws {ValidationError} If input validation fails
   */
  async execute(input: {
    householdId: string;
    seniorIds: string[];
    caregiverId?: string;
    title: string;
    description?: string;
    category: TaskCategory;
    priority?: TaskPriority;
    dueDate?: string;
    dueTime?: string;
    duration?: number;
    recurrence?: TaskRecurrence;
    requiresConfirmation?: boolean;
    confirmationDelayMinutes?: number;
    requester: AuthenticatedRequester;
  }): Promise<Task> {
    // Validate caregiver access
    const member = await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Check plan limit: count active (pending) tasks for this household
    const activeTasks = await this.repository.listHouseholdTasks(input.householdId, { status: 'pending' });
    await this.planLimitGuard.ensureWithinLimit({
      householdId: input.householdId,
      resource: 'tasks',
      currentCount: activeTasks.length,
      limitKey: 'maxActiveTasks',
    });

    // Validate all seniors exist and belong to household
    for (const seniorId of input.seniorIds) {
      const senior = await this.repository.findMemberInHousehold(seniorId, input.householdId);
      if (!senior) {
        throw new ValidationError(`Senior ${seniorId} not found in household.`);
      }
    }

    // If caregiverId provided, validate they belong to household
    if (input.caregiverId) {
      const caregiver = await this.repository.findMemberInHousehold(input.caregiverId, input.householdId);
      if (!caregiver) {
        throw new ValidationError('Caregiver not found in household.');
      }
    }

    // Create task input
    const createInput: CreateTaskInput = {
      householdId: input.householdId,
      seniorIds: input.seniorIds,
      title: input.title,
      category: input.category,
      createdBy: member.id,
      ...(input.caregiverId && { caregiverId: input.caregiverId }),
      ...(input.description && { description: input.description }),
      ...(input.priority && { priority: input.priority }),
      ...(input.dueDate && { dueDate: input.dueDate }),
      ...(input.dueTime && { dueTime: input.dueTime }),
      ...(input.duration && { duration: input.duration }),
      ...(input.recurrence && { recurrence: input.recurrence }),
      ...(input.requiresConfirmation !== undefined && { requiresConfirmation: input.requiresConfirmation }),
      ...(input.confirmationDelayMinutes !== undefined && { confirmationDelayMinutes: input.confirmationDelayMinutes }),
    };

    return this.repository.createTask(createInput);
  }
}
