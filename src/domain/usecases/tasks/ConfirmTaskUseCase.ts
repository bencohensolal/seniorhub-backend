import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Task } from '../../entities/Task.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Confirms a task on behalf of a senior.
 * Any household member can confirm a task that requires confirmation.
 */
export class ConfirmTaskUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    taskId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<Task> {
    // Validate member access
    const member = await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    if (!member) {
      throw new NotFoundError('Member not found.');
    }

    // Verify task exists
    const task = await this.repository.getTaskById(input.taskId, input.householdId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    return this.repository.confirmTask(input.taskId, input.householdId, member.id);
  }
}
