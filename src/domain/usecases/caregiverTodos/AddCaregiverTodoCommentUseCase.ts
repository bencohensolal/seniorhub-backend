import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { CaregiverTodoComment } from '../../entities/CaregiverTodo.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { NotFoundError } from '../../errors/index.js';

/**
 * Adds a comment to a caregiver todo.
 * Any household member can add comments.
 */
export class AddCaregiverTodoCommentUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    todoId: string;
    householdId: string;
    content: string;
    requester: AuthenticatedRequester;
  }): Promise<CaregiverTodoComment> {
    // Validate member access
    const member = await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Validate todo exists
    const todo = await this.repository.getCaregiverTodoById(input.todoId, input.householdId);
    if (!todo) {
      throw new NotFoundError('Caregiver todo not found.');
    }

    return this.repository.addCaregiverTodoComment({
      todoId: input.todoId,
      authorId: member.id,
      content: input.content,
    });
  }
}
