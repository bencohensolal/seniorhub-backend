/**
 * Occurrence Merger Service
 *
 * Shared logic for merging a recurring appointment's base data with
 * an individual occurrence's stored overrides to produce a GeneratedOccurrence.
 */

import type { AppointmentWithReminders } from '../entities/Appointment.js';
import type { AppointmentOccurrence, GeneratedOccurrence, OccurrenceStatus } from '../entities/AppointmentOccurrence.js';

function computeISODateTime(date: string, time: string): string {
  return `${date}T${time}:00.000Z`;
}

function computeEndDateTime(start: string, durationMinutes: number): string {
  const startDate = new Date(start);
  return new Date(startDate.getTime() + durationMinutes * 60 * 1000).toISOString();
}

/**
 * Merge base appointment data with an optional stored occurrence override.
 * The stored occurrence (if provided) wins on any field it specifies.
 */
export function mergeOccurrence(
  appointment: AppointmentWithReminders,
  occurrenceDate: string,
  occurrenceTime: string,
  storedOccurrence?: Pick<AppointmentOccurrence, 'id' | 'status' | 'overrides' | 'createdAt' | 'updatedAt'>,
): GeneratedOccurrence {
  const overrides = storedOccurrence?.overrides ?? {};
  const status: OccurrenceStatus = storedOccurrence?.status ?? 'scheduled';
  const finalTime = overrides.time ?? occurrenceTime;
  const duration = overrides.duration !== undefined ? overrides.duration : appointment.duration;

  const start = computeISODateTime(occurrenceDate, finalTime);
  const end = duration ? computeEndDateTime(start, duration) : null;

  return {
    id: storedOccurrence?.id ?? `${appointment.id}-${occurrenceDate}`,
    recurringAppointmentId: appointment.id,
    householdId: appointment.householdId,
    occurrenceDate,
    occurrenceTime: finalTime,
    start,
    end,
    status,
    isModified: status === 'modified',
    isCancelled: status === 'cancelled',

    title: overrides.title ?? appointment.title,
    type: appointment.type,
    duration,
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

    reminders: appointment.reminders,

    createdAt: storedOccurrence?.createdAt ?? appointment.createdAt,
    updatedAt: storedOccurrence?.updatedAt ?? appointment.updatedAt,
  };
}
