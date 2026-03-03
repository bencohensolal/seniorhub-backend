/**
 * Cancel Occurrence Use Case
 * 
 * Cancels a specific occurrence of a recurring appointment without affecting
 * the rest of the series. Creates or updates an occurrence record with cancelled status.
 */

import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AppointmentOccurrence } from '../../entities/AppointmentOccurrence.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';

export interface CancelOccurrenceInput {
  userId: string;
  householdId: string;
  appointmentId: string;
  occurrenceDate: string; // YYYY-MM-DD
}

export class CancelOccurrenceUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly accessValidator: HouseholdAccessValidator,
  ) {}

  async execute(input: CancelOccurrenceInput): Promise<AppointmentOccurrence> {
    // Validate access - only caregivers can cancel
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
      throw new ValidationError('Cannot cancel occurrence of non-recurring appointment.');
    }

    // Check if an occurrence record already exists for this date
    const existingOccurrence = await this.repository.getOccurrenceByDate(
      input.appointmentId,
      input.occurrenceDate,
      input.householdId,
    );

    if (existingOccurrence) {
      // Update existing occurrence to cancelled
      if (existingOccurrence.status === 'cancelled') {
        throw new ValidationError('Occurrence is already cancelled.');
      }

      return await this.repository.updateOccurrence(
        existingOccurrence.id,
        input.householdId,
        {
          status: 'cancelled',
        },
      );
    } else {
      // Create new occurrence record with cancelled status
      return await this.repository.createOccurrence({
        recurringAppointmentId: input.appointmentId,
        householdId: input.householdId,
        occurrenceDate: input.occurrenceDate,
        occurrenceTime: appointment.time,
        status: 'cancelled',
      });
    }
  }
}
