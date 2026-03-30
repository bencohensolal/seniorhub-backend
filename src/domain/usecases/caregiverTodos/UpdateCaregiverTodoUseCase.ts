import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { CaregiverTodo, UpdateCaregiverTodoInput } from '../../entities/CaregiverTodo.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';

/**
 * Updates an existing caregiver todo.
 * Only caregivers can update todos.
 */
export class UpdateCaregiverTodoUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    todoId: string;
    householdId: string;
    updates: UpdateCaregiverTodoInput;
    requester: AuthenticatedRequester;
  }): Promise<CaregiverTodo> {
    // Validate caregiver access
    await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // Verify todo exists in household
    const todo = await this.repository.getCaregiverTodoById(input.todoId, input.householdId);
    if (!todo) {
      throw new NotFoundError('Caregiver todo not found.');
    }

    // If assignedTo provided, validate member exists in household
    if (input.updates.assignedTo) {
      const assignee = await this.repository.findMemberInHousehold(input.updates.assignedTo, input.householdId);
      if (!assignee) {
        throw new ValidationError('Assigned member not found in household.');
      }
    }

    return this.repository.updateCaregiverTodo(input.todoId, input.householdId, input.updates);
  }
}
