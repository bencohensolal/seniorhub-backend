/**
 * List Appointment Occurrences Use Case
 * 
 * Lists all occurrences for a recurring appointment within a date range,
 * merging base appointment data with any occurrence-specific overrides.
 */

import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { GeneratedOccurrence } from '../../entities/AppointmentOccurrence.js';
import type { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { NotFoundError } from '../../errors/index.js';
import { generateOccurrences } from '../../services/occurrenceGenerator.js';
import { mergeOccurrence } from '../../services/occurrenceMerger.js';

export interface ListAppointmentOccurrencesInput {
  userId: string;
  householdId: string;
  appointmentId: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
}

export class ListAppointmentOccurrencesUseCase {
  constructor(
    private readonly repository: HouseholdRepository,
    private readonly accessValidator: HouseholdAccessValidator,
  ) {}

  async execute(input: ListAppointmentOccurrencesInput): Promise<GeneratedOccurrence[]> {
    // Validate access (tablets are allowed to read occurrences)
    await this.accessValidator.ensureMember(input.userId, input.householdId);

    // Get the appointment
    const appointment = await this.repository.getAppointmentById(
      input.appointmentId,
      input.householdId,
    );

    if (!appointment) {
      throw new NotFoundError('Appointment not found.');
    }

    // Handle one-time appointments
    if (!appointment.recurrence || appointment.recurrence.frequency === 'none') {
      // Check if the appointment date is within the requested range
      if (appointment.date >= input.fromDate && appointment.date <= input.toDate) {
        // Generate a single occurrence for the one-time appointment
        return [mergeOccurrence(appointment, appointment.date, appointment.time, undefined)];
      }
      return []; // Appointment is outside the requested range
    }

    // Generate occurrences from recurrence rule
    const generatedOccurrences = generateOccurrences(
      appointment.recurrence,
      appointment.date,
      appointment.time,
      input.fromDate,
      input.toDate,
    );

    // Fetch any stored occurrence overrides/modifications
    const storedOccurrences = await this.repository.listOccurrences(
      input.appointmentId,
      input.householdId,
      input.fromDate,
      input.toDate,
    );

    // Create a map of stored occurrences by date for quick lookup
    const storedMap = new Map(
      storedOccurrences.map(occ => [occ.occurrenceDate, occ])
    );

    // Merge generated occurrences with stored overrides
    const result: GeneratedOccurrence[] = generatedOccurrences
      .map(generated => {
        const stored = storedMap.get(generated.date);
        if (stored?.status === 'cancelled') {
          return null;
        }
        return mergeOccurrence(appointment, generated.date, generated.time, stored);
      })
      .filter((occ): occ is GeneratedOccurrence => occ !== null);

    return result;
  }
}
