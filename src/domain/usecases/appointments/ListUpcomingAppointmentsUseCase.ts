/**
 * List Upcoming Appointments Use Case
 *
 * Returns all upcoming occurrences (one-time + recurring) for a household
 * within a date range, sorted chronologically. Recurring appointments are
 * expanded into individual occurrences and merged with any stored overrides.
 * Cancelled occurrences are excluded.
 */

import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { GeneratedOccurrence } from '../../entities/AppointmentOccurrence.js';
import type { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { generateOccurrences } from '../../services/occurrenceGenerator.js';
import { mergeOccurrence } from '../../services/occurrenceMerger.js';

export interface ListUpcomingAppointmentsInput {
  userId: string;
  householdId: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
}

export class ListUpcomingAppointmentsUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly accessValidator: HouseholdAccessValidator,
  ) {}

  async execute(input: ListUpcomingAppointmentsInput): Promise<GeneratedOccurrence[]> {
    await this.accessValidator.ensureMember(input.userId, input.householdId);

    const appointments = await this.repository.listHouseholdAppointments(input.householdId);

    // Fetch all stored occurrence overrides for the range in a single query
    const storedOccurrences = await this.repository.listAllHouseholdOccurrencesInRange(
      input.householdId,
      input.fromDate,
      input.toDate,
    );

    // Group stored overrides by appointmentId → date for O(1) lookups
    const storedByAppointment = new Map<string, Map<string, typeof storedOccurrences[0]>>();
    for (const occ of storedOccurrences) {
      if (!storedByAppointment.has(occ.recurringAppointmentId)) {
        storedByAppointment.set(occ.recurringAppointmentId, new Map());
      }
      storedByAppointment.get(occ.recurringAppointmentId)!.set(occ.occurrenceDate, occ);
    }

    const result: GeneratedOccurrence[] = [];

    for (const appointment of appointments) {
      const overridesForAppointment = storedByAppointment.get(appointment.id) ?? new Map();

      if (!appointment.recurrence || appointment.recurrence.frequency === 'none') {
        // One-time appointment: include if it falls within the requested range
        if (appointment.date >= input.fromDate && appointment.date <= input.toDate) {
          const stored = overridesForAppointment.get(appointment.date);
          if (stored?.status !== 'cancelled') {
            result.push(mergeOccurrence(appointment, appointment.date, appointment.time, stored));
          }
        }
      } else {
        // Recurring appointment: expand occurrences within the range
        const generatedDates = generateOccurrences(
          appointment.recurrence,
          appointment.date,
          appointment.time,
          input.fromDate,
          input.toDate,
        );

        for (const generated of generatedDates) {
          const stored = overridesForAppointment.get(generated.date);
          if (stored?.status === 'cancelled') {
            continue;
          }
          result.push(mergeOccurrence(appointment, generated.date, generated.time, stored));
        }
      }
    }

    // Sort chronologically: by date first, then by time within the same day
    result.sort((a, b) => {
      if (a.occurrenceDate !== b.occurrenceDate) {
        return a.occurrenceDate < b.occurrenceDate ? -1 : 1;
      }
      return a.occurrenceTime < b.occurrenceTime ? -1 : 1;
    });

    return result;
  }
}
