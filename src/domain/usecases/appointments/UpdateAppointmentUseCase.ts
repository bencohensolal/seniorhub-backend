import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Appointment, UpdateAppointmentInput } from '../../entities/Appointment.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Updates an existing appointment.
 * Only household members can update appointments.
 */
export class UpdateAppointmentUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Appointment update data with IDs and requester info
   * @returns The updated appointment
   * @throws {ForbiddenError} If requester is not a member of the household
   * @throws {NotFoundError} If appointment not found
   */
  async execute(input: {
    appointmentId: string;
    householdId: string;
    requester: AuthenticatedRequester;
    data: UpdateAppointmentInput;
  }): Promise<Appointment> {
    // Validate household membership
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    return this.repository.updateAppointment(input.appointmentId, input.householdId, input.data);
  }
}
