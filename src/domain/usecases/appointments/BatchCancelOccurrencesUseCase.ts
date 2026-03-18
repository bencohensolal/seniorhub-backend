/**
 * Batch Cancel Occurrences Use Case
 *
 * Cancels multiple occurrences of a recurring appointment in a single call.
 * Fails fast if any of the targeted occurrences is already cancelled.
 */

import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AppointmentOccurrence } from '../../entities/AppointmentOccurrence.js';
import type { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';

export interface BatchCancelOccurrencesInput {
  userId: string;
  householdId: string;
  appointmentId: string;
  dates: string[]; // YYYY-MM-DD[]
}

export class BatchCancelOccurrencesUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly accessValidator: HouseholdAccessValidator,
  ) {}

  async execute(input: BatchCancelOccurrencesInput): Promise<AppointmentOccurrence[]> {
    await this.accessValidator.ensureCaregiver(input.userId, input.householdId);

    const appointment = await this.repository.getAppointmentById(input.appointmentId, input.householdId);
    if (!appointment) {
      throw new NotFoundError('Appointment not found.');
    }

    if (!appointment.recurrence || appointment.recurrence.frequency === 'none') {
      throw new ValidationError('Cannot cancel occurrence of non-recurring appointment.');
    }

    if (input.dates.length === 0) {
      throw new ValidationError('At least one date must be provided.');
    }

    const results: AppointmentOccurrence[] = [];

    for (const date of input.dates) {
      const existing = await this.repository.getOccurrenceByDate(
        input.appointmentId,
        date,
        input.householdId,
      );

      if (existing) {
        if (existing.status === 'cancelled') {
          throw new ValidationError(`Occurrence on ${date} is already cancelled.`);
        }
        results.push(await this.repository.updateOccurrence(existing.id, input.householdId, {
          status: 'cancelled',
        }));
      } else {
        results.push(await this.repository.createOccurrence({
          recurringAppointmentId: input.appointmentId,
          householdId: input.householdId,
          occurrenceDate: date,
          occurrenceTime: appointment.time,
          status: 'cancelled',
        }));
      }
    }

    return results;
  }
}
