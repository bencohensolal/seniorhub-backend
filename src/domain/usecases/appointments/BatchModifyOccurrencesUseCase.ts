/**
 * Batch Modify Occurrences Use Case
 *
 * Modifies multiple occurrences of a recurring appointment in a single call.
 * Each modification targets a specific date and provides override fields.
 * Fails fast if any occurrence is cancelled (must be restored first).
 */

import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AppointmentOccurrence, OccurrenceOverrides } from '../../entities/AppointmentOccurrence.js';
import type { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { NotFoundError, ValidationError } from '../../errors/index.js';

export interface BatchModifyOccurrencesInput {
  userId: string;
  householdId: string;
  appointmentId: string;
  modifications: Array<{
    occurrenceDate: string; // YYYY-MM-DD
    overrides: OccurrenceOverrides;
  }>;
}

export class BatchModifyOccurrencesUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly accessValidator: HouseholdAccessValidator,
  ) {}

  async execute(input: BatchModifyOccurrencesInput): Promise<AppointmentOccurrence[]> {
    await this.accessValidator.ensureCaregiver(input.userId, input.householdId);

    const appointment = await this.repository.getAppointmentById(input.appointmentId, input.householdId);
    if (!appointment) {
      throw new NotFoundError('Appointment not found.');
    }

    if (!appointment.recurrence || appointment.recurrence.frequency === 'none') {
      throw new ValidationError('Cannot modify occurrence of non-recurring appointment.');
    }

    if (input.modifications.length === 0) {
      throw new ValidationError('At least one modification must be provided.');
    }

    const results: AppointmentOccurrence[] = [];

    for (const mod of input.modifications) {
      if (Object.keys(mod.overrides).length === 0) {
        throw new ValidationError(`Modification for ${mod.occurrenceDate} must include at least one field.`);
      }

      const existing = await this.repository.getOccurrenceByDate(
        input.appointmentId,
        mod.occurrenceDate,
        input.householdId,
      );

      if (existing) {
        if (existing.status === 'cancelled') {
          throw new ValidationError(
            `Cannot modify cancelled occurrence on ${mod.occurrenceDate}. Restore it first.`,
          );
        }
        results.push(await this.repository.updateOccurrence(existing.id, input.householdId, {
          status: 'modified',
          overrides: mod.overrides,
        }));
      } else {
        results.push(await this.repository.createOccurrence({
          recurringAppointmentId: input.appointmentId,
          householdId: input.householdId,
          occurrenceDate: mod.occurrenceDate,
          occurrenceTime: mod.overrides.time ?? appointment.time,
          status: 'modified',
          overrides: mod.overrides,
        }));
      }
    }

    return results;
  }
}
