import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { TaskReminder, UpdateTaskReminderInput } from '../../entities/TaskReminder.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Updates a task reminder.
 * Only caregivers can update task reminders.
 */
export class UpdateTaskReminderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Reminder update data
   * @returns The updated reminder
   * @throws {ForbiddenError} If requester is not a caregiver in the household
   * @throws {NotFoundError} If reminder is not found
   */
  async execute(input: {
    reminderId: string;
    taskId: string;
    householdId: string;
    updates: UpdateTaskReminderInput;
    requester: AuthenticatedRequester;
  }): Promise<TaskReminder> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify reminder exists
    const reminder = await this.repository.getTaskReminderById(
      input.reminderId,
      input.taskId,
      input.householdId,
    );
    if (!reminder) {
      throw new NotFoundError('Task reminder not found.');
    }

    return this.repository.updateTaskReminder(
      input.reminderId,
      input.taskId,
      input.householdId,
      input.updates,
    );
  }
}
