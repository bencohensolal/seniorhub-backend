import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Task, CompleteTaskInput } from '../../entities/Task.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Marks a task as completed.
 * All household members can complete tasks.
 */
export class CompleteTaskUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Task completion data
   * @returns The completed task
   * @throws {ForbiddenError} If requester is not a member of the household
   * @throws {NotFoundError} If task is not found
   */
  async execute(input: {
    taskId: string;
    householdId: string;
    completedAt?: string;
    requester: AuthenticatedRequester;
  }): Promise<Task> {
    // Validate member access (any member can complete)
    const member = await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Tablets cannot complete tasks (read-only access)
    if (!member) {
      throw new NotFoundError('Tablets cannot complete tasks.');
    }

    // Verify task exists
    const task = await this.repository.getTaskById(input.taskId, input.householdId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const completeInput: CompleteTaskInput = input.completedAt 
      ? { completedAt: input.completedAt }
      : {};

    return this.repository.completeTask(input.taskId, input.householdId, completeInput, member.id);
  }
}
