import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Deletes an appointment and all its reminders.
 * Only household members can delete appointments.
 */
export class DeleteAppointmentUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Appointment ID, household ID, and requester info
   * @throws {ForbiddenError} If requester is not a member of the household
   * @throws {NotFoundError} If appointment not found
   */
  async execute(input: {
    appointmentId: string;
    householdId: string;
    requester: AuthenticatedRequester;
  }): Promise<void> {
    // Validate household membership
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    await this.repository.deleteAppointment(input.appointmentId, input.householdId);
  }
}
