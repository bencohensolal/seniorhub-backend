import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Deletes a caregiver todo.
 * Only caregivers can delete todos.
 */
export class DeleteCaregiverTodoUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    todoId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify todo exists
    const todo = await this.repository.getCaregiverTodoById(input.todoId, input.householdId);
    if (!todo) {
      throw new NotFoundError('Caregiver todo not found.');
    }

    await this.repository.deleteCaregiverTodo(input.todoId, input.householdId);
  }
}
