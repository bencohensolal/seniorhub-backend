/**
 * List Appointment Occurrences Use Case
 * 
 * Lists all occurrences for a recurring appointment within a date range,
 * merging base appointment data with any occurrence-specific overrides.
 */

import type { HouseholdRepository } from '../../repositories/HouseholdRepository.js';
import type { AppointmentWithReminders } from '../../entities/Appointment.js';
import type { GeneratedOccurrence } from '../../entities/AppointmentOccurrence.js';
import { HouseholdAccessValidator } from '../shared/HouseholdAccessValidator.js';
import { NotFoundError } from '../../errors/index.js';
import { generateOccurrences } from '../../services/occurrenceGenerator.js';

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
    // Validate access
    await this.accessValidator.ensureMember(input.userId, input.householdId);

    // Get the appointment
    const appointment = await this.repository.getAppointmentById(
      input.appointmentId,
      input.householdId,
    );

    if (!appointment) {
      throw new NotFoundError('Appointment not found.');
    }

    // Check if appointment is recurring
    if (!appointment.recurrence || appointment.recurrence.frequency === 'none') {
      return []; // Non-recurring appointments have no occurrences
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
    const result: GeneratedOccurrence[] = generatedOccurrences.map(generated => {
      const stored = storedMap.get(generated.date);

      if (stored && stored.status === 'cancelled') {
        // Skip cancelled occurrences
        return null;
      }

      return this.mergeOccurrence(appointment, generated.date, generated.time, stored);
    }).filter((occ): occ is GeneratedOccurrence => occ !== null);

    return result;
  }

  /**
   * Merge base appointment data with occurrence overrides
   */
  private mergeOccurrence(
    appointment: AppointmentWithReminders,
    occurrenceDate: string,
    occurrenceTime: string,
    storedOccurrence?: {
      id: string;
      status: string;
      overrides: any;
      createdAt: string;
      updatedAt: string;
    },
  ): GeneratedOccurrence {
    const overrides = storedOccurrence?.overrides || {};
    const isModified = storedOccurrence?.status === 'modified' || false;
    const status = (storedOccurrence?.status || 'scheduled') as any;

    return {
      id: storedOccurrence?.id || `${appointment.id}-${occurrenceDate}`,
      recurringAppointmentId: appointment.id,
      householdId: appointment.householdId,
      occurrenceDate,
      occurrenceTime: overrides.time || occurrenceTime,
      status,
      isModified,
      isCancelled: status === 'cancelled',
      
      // Merge fields with overrides taking precedence
      title: overrides.title || appointment.title,
      type: appointment.type,
      duration: overrides.duration !== undefined ? overrides.duration : appointment.duration,
      seniorIds: appointment.seniorIds,
      caregiverId: appointment.caregiverId,
      address: overrides.address !== undefined ? overrides.address : appointment.address,
      locationName: overrides.locationName !== undefined ? overrides.locationName : appointment.locationName,
      phoneNumber: overrides.phoneNumber !== undefined ? overrides.phoneNumber : appointment.phoneNumber,
      description: overrides.description !== undefined ? overrides.description : appointment.description,
      professionalName: overrides.professionalName !== undefined ? overrides.professionalName : appointment.professionalName,
      preparation: overrides.preparation !== undefined ? overrides.preparation : appointment.preparation,
      documentsToTake: overrides.documentsToTake !== undefined ? overrides.documentsToTake : appointment.documentsToTake,
      transportArrangement: overrides.transportArrangement !== undefined ? overrides.transportArrangement : appointment.transportArrangement,
      notes: overrides.notes !== undefined ? overrides.notes : appointment.notes,
      
      // Reminders are inherited from the recurring appointment
      reminders: appointment.reminders,
      
      createdAt: storedOccurrence?.createdAt || appointment.createdAt,
      updatedAt: storedOccurrence?.updatedAt || appointment.updatedAt,
    };
  }
}
