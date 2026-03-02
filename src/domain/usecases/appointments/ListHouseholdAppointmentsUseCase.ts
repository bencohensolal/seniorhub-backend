import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { AppointmentWithReminders } from '../../entities/Appointment.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Lists all appointments for a household.
 * Only household members can access appointments.
 */
export class ListHouseholdAppointmentsUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Household ID and requester info
   * @returns List of appointments with their reminders
   * @throws {ForbiddenError} If requester is not a member of the household
   */
  async execute(input: { householdId: string; requester: AuthenticatedRequester }): Promise<AppointmentWithReminders[]> {
    // Validate household membership
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    return this.repository.listHouseholdAppointments(input.householdId);
  }
}
