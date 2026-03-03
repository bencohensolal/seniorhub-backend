import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Deletes a task and its reminders.
 * Only caregivers can delete tasks.
 */
export class DeleteTaskUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Task identifier and household
   * @throws {ForbiddenError} If requester is not a caregiver in the household
   * @throws {NotFoundError} If task is not found
   */
  async execute(input: {
    taskId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify task exists
    const task = await this.repository.getTaskById(input.taskId, input.householdId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    await this.repository.deleteTask(input.taskId, input.householdId);
  }
}
