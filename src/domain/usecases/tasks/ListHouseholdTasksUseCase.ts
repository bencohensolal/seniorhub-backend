import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { TaskWithReminders } from '../../entities/Task.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Lists all tasks in a household with optional filters.
 * All household members can list tasks.
 */
export class ListHouseholdTasksUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Household identifier with requester info and optional filters
   * @returns List of tasks with reminders in the household
   * @throws {ForbiddenError} If requester is not a member of the household
   */
  async execute(input: {
    householdId: string;
    requester: AuthenticatedRequester;
    filters?: {
      status?: string;
      seniorId?: string;
      category?: string;
      fromDate?: string;
      toDate?: string;
    };
  }): Promise<TaskWithReminders[]> {
    // Validate member access
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Get all tasks with filters
    return this.repository.listHouseholdTasks(input.householdId, input.filters);
  }
}
