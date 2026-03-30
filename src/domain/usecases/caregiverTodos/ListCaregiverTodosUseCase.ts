import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { CaregiverTodoWithComments } from '../../entities/CaregiverTodo.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Lists all caregiver todos in a household with optional filters.
 * All household members can list todos.
 */
export class ListCaregiverTodosUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    requester: AuthenticatedRequester;
    filters?: { status?: string; assignedTo?: string };
  }): Promise<CaregiverTodoWithComments[]> {
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);
    return this.repository.listCaregiverTodos(input.householdId, input.filters);
  }
}
