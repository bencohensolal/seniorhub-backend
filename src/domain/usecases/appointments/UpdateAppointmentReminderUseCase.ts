import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { AppointmentReminder, UpdateAppointmentReminderInput } from '../../entities/AppointmentReminder.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Updates an appointment reminder.
 * Only household members can update reminders.
 */
export class UpdateAppointmentReminderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Reminder update data with IDs and requester info
   * @returns The updated reminder
   * @throws {ForbiddenError} If requester is not a member of the household
   * @throws {NotFoundError} If reminder not found
   */
  async execute(input: {
    reminderId: string;
    appointmentId: string;
    householdId: string;
    requester: AuthenticatedRequester;
    data: UpdateAppointmentReminderInput;
  }): Promise<AppointmentReminder> {
    // Validate household membership
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    return this.repository.updateAppointmentReminder(input.reminderId, input.appointmentId, input.householdId, input.data);
  }
}
