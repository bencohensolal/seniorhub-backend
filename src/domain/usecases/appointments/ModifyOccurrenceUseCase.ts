/**
 * Modify Occurrence Use Case
 * 
 * Modifies a specific occurrence of a recurring appointment without affecting
 * the rest of the series. Creates or updates an occurrence override record.
 */

import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AppointmentOccurrence, OccurrenceOverrides } from '../../entities/AppointmentOccurrence.js';
import type { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';

export interface ModifyOccurrenceInput {
  userId: string;
  householdId: string;
  appointmentId: string;
  occurrenceDate: string; // YYYY-MM-DD
  overrides: OccurrenceOverrides;
}

export class ModifyOccurrenceUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly accessValidator: HouseholdAccessValidator,
  ) {}

  async execute(input: ModifyOccurrenceInput): Promise<AppointmentOccurrence> {
    // Validate access - only caregivers can modify
    await this.accessValidator.ensureCaregiver(input.userId, input.householdId);

    // Verify the appointment exists and is recurring
    const appointment = await this.repository.getAppointmentById(
      input.appointmentId,
      input.householdId,
    );

    if (!appointment) {
      throw new NotFoundError('Appointment not found.');
    }

    if (!appointment.recurrence || appointment.recurrence.frequency === 'none') {
      throw new ValidationError('Cannot modify occurrence of non-recurring appointment.');
    }

    // Validate that at least one override is provided
    if (Object.keys(input.overrides).length === 0) {
      throw new ValidationError('At least one field must be modified.');
    }

    // Check if an occurrence record already exists for this date
    const existingOccurrence = await this.repository.getOccurrenceByDate(
      input.appointmentId,
      input.occurrenceDate,
      input.householdId,
    );

    if (existingOccurrence) {
      // Update existing occurrence
      if (existingOccurrence.status === 'cancelled') {
        throw new ValidationError('Cannot modify a cancelled occurrence. Please restore it first.');
      }

      return await this.repository.updateOccurrence(
        existingOccurrence.id,
        input.householdId,
        {
          status: 'modified',
          overrides: input.overrides,
        },
      );
    } else {
      // Create new occurrence record with overrides
      return await this.repository.createOccurrence({
        recurringAppointmentId: input.appointmentId,
        householdId: input.householdId,
        occurrenceDate: input.occurrenceDate,
        occurrenceTime: input.overrides.time || appointment.time,
        status: 'modified',
        overrides: input.overrides,
      });
    }
  }
}
