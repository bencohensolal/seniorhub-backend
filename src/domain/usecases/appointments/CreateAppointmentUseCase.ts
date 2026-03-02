import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Appointment, CreateAppointmentInput } from '../../entities/Appointment.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';

/**
 * Creates a new appointment for a household.
 * Only household members can create appointments.
 */
export class CreateAppointmentUseCase {
  private readonly accessValidator: HouseholdAccessValidator;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
  }

  /**
   * @param input - Appointment creation data with requester info
   * @returns The created appointment
   * @throws {ForbiddenError} If requester is not a member of the household
   */
  async execute(input: CreateAppointmentInput & { requester: AuthenticatedRequester }): Promise<Appointment> {
    // Validate household membership
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Extract requester and create appointment
    const { requester, ...appointmentData } = input;

    return this.repository.createAppointment(appointmentData);
  }
}
