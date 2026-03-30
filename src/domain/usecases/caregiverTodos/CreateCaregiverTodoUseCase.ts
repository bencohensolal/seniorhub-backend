import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { CaregiverTodo, CaregiverTodoPriority, CreateCaregiverTodoInput } from '../../entities/CaregiverTodo.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { ValidationError } from '../../errors/index.js';

/**
 * Creates a new caregiver todo for a household.
 * Only caregivers can create todos.
 */
export class CreateCaregiverTodoUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  async execute(input: {
    householdId: string;
    title: string;
    description?: string;
    priority?: CaregiverTodoPriority;
    assignedTo?: string;
    dueDate?: string;
    requester: AuthenticatedRequester;
  }): Promise<CaregiverTodo> {
    // Validate caregiver access
    const member = await this.accessValidator.ensureCaregiver(input.requester.userId, input.householdId);

    // If assignedTo provided, validate member exists in household
    if (input.assignedTo) {
      const assignee = await this.repository.findMemberInHousehold(input.assignedTo, input.householdId);
      if (!assignee) {
        throw new ValidationError('Assigned member not found in household.');
      }
    }

    const createInput: CreateCaregiverTodoInput = {
      householdId: input.householdId,
      title: input.title,
      createdBy: member.id,
      ...(input.description && { description: input.description }),
      ...(input.priority && { priority: input.priority }),
      ...(input.assignedTo && { assignedTo: input.assignedTo }),
      ...(input.dueDate && { dueDate: input.dueDate }),
    };

    return this.repository.createCaregiverTodo(createInput);
  }
}
