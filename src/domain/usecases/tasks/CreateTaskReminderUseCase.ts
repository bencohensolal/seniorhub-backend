import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { TaskReminder, CreateTaskReminderInput } from '../../entities/TaskReminder.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Creates a reminder for a task.
 * Only caregivers can create task reminders.
 */
export class CreateTaskReminderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Reminder creation data
   * @returns The newly created reminder
   * @throws {ForbiddenError} If requester is not a caregiver in the household
   * @throws {NotFoundError} If task is not found
   */
  async execute(input: {
    taskId: string;
    householdId: string;
    time?: string;
    daysOfWeek?: number[];
    triggerBefore?: number;
    customMessage?: string;
    enabled?: boolean;
    requester: AuthenticatedRequester;
  }): Promise<TaskReminder> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify task exists
    const task = await this.repository.getTaskById(input.taskId, input.householdId);
    if (!task) {
      throw new NotFoundError('Task not found.');
    }

    const createInput: CreateTaskReminderInput = {
      taskId: input.taskId,
      ...(input.time !== undefined && { time: input.time }),
      ...(input.daysOfWeek !== undefined && { daysOfWeek: input.daysOfWeek }),
      ...(input.triggerBefore !== undefined && { triggerBefore: input.triggerBefore }),
      ...(input.customMessage !== undefined && { customMessage: input.customMessage }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
    };

    return this.repository.createTaskReminder(createInput);
  }
}
