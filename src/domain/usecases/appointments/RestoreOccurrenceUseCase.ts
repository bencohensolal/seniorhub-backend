/**
 * Restore Occurrence Use Case
 *
 * Restores a previously cancelled occurrence of a recurring appointment.
 * If the occurrence had overrides before cancellation they are preserved and
 * the status reverts to 'modified'; otherwise it reverts to 'scheduled'.
 */

import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AppointmentOccurrence } from '../../entities/AppointmentOccurrence.js';
import type { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';

export interface RestoreOccurrenceInput {
  userId: string;
  householdId: string;
  appointmentId: string;
  occurrenceDate: string; // YYYY-MM-DD
}

export class RestoreOccurrenceUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly accessValidator: HouseholdAccessValidator,
  ) {}

  async execute(input: RestoreOccurrenceInput): Promise<AppointmentOccurrence> {
    await this.accessValidator.ensureCaregiver(input.userId, input.householdId);

    const appointment = await this.repository.getAppointmentById(input.appointmentId, input.householdId);
    if (!appointment) {
      throw new NotFoundError('Appointment not found.');
    }

    const existing = await this.repository.getOccurrenceByDate(
      input.appointmentId,
      input.occurrenceDate,
      input.householdId,
    );

    if (!existing) {
      throw new NotFoundError('Occurrence not found.');
    }

    if (existing.status !== 'cancelled') {
      throw new ValidationError('Occurrence is not cancelled.');
    }

    // Preserve overrides if any were set before cancellation
    const hasOverrides = existing.overrides !== null && Object.keys(existing.overrides).length > 0;
    const restoredStatus = hasOverrides ? 'modified' : 'scheduled';

    return this.repository.updateOccurrence(existing.id, input.householdId, {
      status: restoredStatus,
    });
  }
}
