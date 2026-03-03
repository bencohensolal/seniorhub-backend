import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Task, UpdateTaskInput } from '../../entities/Task.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Updates an existing task.
 * Only caregivers can update tasks.
 */
export class UpdateTaskUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Task update data
   * @returns The updated task
   * @throws {ForbiddenError} If requester is not a caregiver in the household
   * @throws {NotFoundError} If task is not found
   */
  async execute(input: {
    taskId: string;
    householdId: string;
    updates: UpdateTaskInput;
    requester: AuthenticatedRequester;
  }): Promise<Task> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify task exists in household
    const task = await this.repository.getTaskById(input.taskId, input.householdId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    return this.repository.updateTask(input.taskId, input.householdId, input.updates);
  }
}
