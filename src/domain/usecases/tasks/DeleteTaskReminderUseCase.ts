import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Deletes a task reminder.
 * Only caregivers can delete task reminders.
 */
export class DeleteTaskReminderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Reminder identifier
   * @throws {ForbiddenError} If requester is not a caregiver in the household
   * @throws {NotFoundError} If reminder is not found
   */
  async execute(input: {
    reminderId: string;
    taskId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
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

    await this.repository.deleteTaskReminder(input.reminderId, input.taskId, input.householdId);
  }
}
