import type { AuthenticatedRequester } from '../../entities/Household.js';
import type { Appointment, CreateAppointmentInput } from '../../entities/Appointment.js';
import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import { HouseholdAccessValidator } from '../shared/index.js';
import { PlanLimitGuard } from '../shared/PlanLimitGuard.js';

/**
 * Creates a new appointment for a household.
 * Only household members can create appointments.
 */
export class CreateAppointmentUseCase {
  private readonly accessValidator: HouseholdAccessValidator;
  private readonly planLimitGuard: PlanLimitGuard;

  constructor(private readonly repository: HouseholdRepository) {
    this.accessValidator = new HouseholdAccessValidator(repository);
    this.planLimitGuard = new PlanLimitGuard(repository);
  }

  /**
   * @param input - Appointment creation data with requester info
   * @returns The created appointment
   * @throws {ForbiddenError} If requester is not a member of the household
   */
  async execute(input: CreateAppointmentInput & { requester: AuthenticatedRequester }): Promise<Appointment> {
    // Validate household membership
    await this.accessValidator.ensureMember(input.requester.userId, input.householdId);

    // Check plan limit: count active appointments for this household
    const appointments = await this.repository.listHouseholdAppointments(input.householdId);
    await this.planLimitGuard.ensureWithinLimit({
      householdId: input.householdId,
      resource: 'appointments',
      currentCount: appointments.length,
      limitKey: 'maxActiveAppointments',
    });

    // Extract requester and create appointment
    const { requester, ...appointmentData } = input;

    return this.repository.createAppointment(appointmentData);
  }
}
