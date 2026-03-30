import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { CaregiverTodo } from '../../entities/CaregiverTodo.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';

/**
 * Marks a caregiver todo as completed.
 * Any household member can complete a todo.
 */
export class CompleteCaregiverTodoUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    todoId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<CaregiverTodo> {
    // Validate member access (any member can complete)
    const member = await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    if (!member) {
      throw new ForbiddenError('Only household members can complete todos.');
    }

    // Verify todo exists
    const todo = await this.repository.getCaregiverTodoById(input.todoId, input.householdId);
    if (!todo) {
      throw new NotFoundError('Caregiver todo not found.');
    }

    return this.repository.completeCaregiverTodo(input.todoId, input.householdId, member.id);
  }
}
