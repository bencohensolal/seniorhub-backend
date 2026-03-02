import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { AppointmentReminder, CreateAppointmentReminderInput } from '../../entities/AppointmentReminder.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Creates a reminder for an appointment.
 * Only household members can create reminders.
 */
export class CreateAppointmentReminderUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Reminder creation data with requester info
   * @returns The created reminder
   * @throws {ForbiddenError} If requester is not a member of the household
   */
  async execute(input: CreateAppointmentReminderInput & { householdId: string; requester: AuthenticatedRequester }): Promise<AppointmentReminder> {
    // Validate household membership
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Extract requester and householdId, then create reminder
    const { requester, householdId, ...reminderData } = input;

    return this.repository.createAppointmentReminder(reminderData);
  }
}
