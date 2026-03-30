import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { CaregiverTodo } from '../../entities/CaregiverTodo.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';

/**
 * Sends a nudge for a caregiver todo.
 * Any household member can nudge.
 * Enforces a 24-hour cooldown between nudges.
 */
export class NudgeCaregiverTodoUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    todoId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<CaregiverTodo> {
    // Validate member access
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Get todo by ID, validate it exists
    const todo = await this.repository.getCaregiverTodoById(input.todoId, input.householdId);
    if (!todo) {
      throw new NotFoundError('Caregiver todo not found.');
    }

    // Check cooldown: if lastNudgedAt is less than 24h ago, throw error
    if (todo.lastNudgedAt) {
      const lastNudged = new Date(todo.lastNudgedAt);
      const now = new Date();
      const hoursSinceLastNudge = (now.getTime() - lastNudged.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastNudge < 24) {
        throw new ValidationError('Nudge already sent recently. Please wait before nudging again.');
      }
    }

    return this.repository.nudgeCaregiverTodo(input.todoId, input.householdId);
  }
}
