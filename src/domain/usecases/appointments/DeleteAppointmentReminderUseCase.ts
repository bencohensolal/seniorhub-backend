import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Deletes an appointment reminder.
 * Only household members can delete reminders.
 */
export class DeleteAppointmentReminderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Reminder ID, appointment ID, household ID, and requester info
   * @throws {ForbiddenError} If requester is not a member of the household
   * @throws {NotFoundError} If reminder not found
   */
  async execute(input: {
    reminderId: string;
    appointmentId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Validate household membership
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    await this.repository.deleteAppointmentReminder(input.reminderId, input.appointmentId, input.householdId);
  }
}
