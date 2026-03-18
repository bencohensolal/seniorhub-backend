import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { Appointment, AppointmentWithReminders, CreateAppointmentInput, UpdateAppointmentInput, AppointmentType, AppointmentStatus } from '../../../domain/entities/Appointment.js';
import type { AppointmentReminder, CreateAppointmentReminderInput, UpdateAppointmentReminderInput } from '../../../domain/entities/AppointmentReminder.js';
import type { AppointmentOccurrence, CreateOccurrenceInput, UpdateOccurrenceInput } from '../../../domain/entities/AppointmentOccurrence.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  mapAppointment,
  mapAppointmentReminder,
  mapOccurrence,
} from './helpers.js';

export class PostgresAppointmentRepository {
  constructor(protected readonly pool: Pool) {}

  async listHouseholdAppointments(householdId: string): Promise<AppointmentWithReminders[]> {
    // Fetch all appointments for the household
    const appointmentsResult = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      type: AppointmentType;
      date: string | Date;
      time: string;
      duration: number | null;
      senior_ids: string;
      caregiver_id: string | null;
      address: string | null;
      location_name: string | null;
      phone_number: string | null;
      description: string | null;
      professional_name: string | null;
      preparation: string | null;
      documents_to_take: string | null;
      transport_arrangement: string | null;
      recurrence: string | null;
      status: AppointmentStatus;
      notes: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, title, type, date, time, duration,
              senior_ids::text, caregiver_id, address, location_name, phone_number,
              description, professional_name, preparation, documents_to_take,
              transport_arrangement, recurrence::text, status, notes,
              created_at, updated_at
       FROM appointments
       WHERE household_id = $1
       ORDER BY date ASC, time ASC`,
      [householdId],
    );

    // Fetch all reminders for these appointments
    const appointmentIds = appointmentsResult.rows.map(row => row.id);
    let remindersMap: Map<string, AppointmentReminder[]> = new Map();

    if (appointmentIds.length > 0) {
      const remindersResult = await this.pool.query<{
        id: string;
        appointment_id: string;
        trigger_before: number;
        custom_message: string | null;
        enabled: boolean;
        created_at: string | Date;
        updated_at: string | Date;
      }>(
        `SELECT id, appointment_id, trigger_before, custom_message, enabled, created_at, updated_at
         FROM appointment_reminders
         WHERE appointment_id = ANY($1)
         ORDER BY trigger_before DESC`,
        [appointmentIds],
      );

      // Group reminders by appointment_id
      for (const row of remindersResult.rows) {
        const reminder = mapAppointmentReminder(row);
        if (!remindersMap.has(row.appointment_id)) {
          remindersMap.set(row.appointment_id, []);
        }
        remindersMap.get(row.appointment_id)!.push(reminder);
      }
    }

    // Combine appointments with their reminders
    return appointmentsResult.rows.map(row => ({
      ...mapAppointment(row),
      reminders: remindersMap.get(row.id) || [],
    }));
  }

  async getAppointmentById(appointmentId: string, householdId: string): Promise<AppointmentWithReminders | null> {
    const appointmentResult = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      type: AppointmentType;
      date: string | Date;
      time: string;
      duration: number | null;
      senior_ids: string;
      caregiver_id: string | null;
      address: string | null;
      location_name: string | null;
      phone_number: string | null;
      description: string | null;
      professional_name: string | null;
      preparation: string | null;
      documents_to_take: string | null;
      transport_arrangement: string | null;
      recurrence: string | null;
      status: AppointmentStatus;
      notes: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, title, type, date, time, duration,
              senior_ids::text, caregiver_id, address, location_name, phone_number,
              description, professional_name, preparation, documents_to_take,
              transport_arrangement, recurrence::text, status, notes,
              created_at, updated_at
       FROM appointments
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [appointmentId, householdId],
    );

    const row = appointmentResult.rows[0];
    if (!row) {
      return null;
    }

    // Fetch reminders for this appointment
    const remindersResult = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, appointment_id, trigger_before, custom_message, enabled, created_at, updated_at
       FROM appointment_reminders
       WHERE appointment_id = $1
       ORDER BY trigger_before DESC`,
      [appointmentId],
    );

    return {
      ...mapAppointment(row),
      reminders: remindersResult.rows.map(mapAppointmentReminder),
    };
  }

  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    const id = randomUUID();
    const now = nowIso();
    const status = input.status || 'scheduled';

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      type: AppointmentType;
      date: string | Date;
      time: string;
      duration: number | null;
      senior_ids: string;
      caregiver_id: string | null;
      address: string | null;
      location_name: string | null;
      phone_number: string | null;
      description: string | null;
      professional_name: string | null;
      preparation: string | null;
      documents_to_take: string | null;
      transport_arrangement: string | null;
      recurrence: string | null;
      status: AppointmentStatus;
      notes: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO appointments (
         id, household_id, title, type, date, time, duration,
         senior_ids, caregiver_id, address, location_name, phone_number,
         description, professional_name, preparation, documents_to_take,
         transport_arrangement, recurrence, status, notes,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $21)
       RETURNING id, household_id, title, type, date, time, duration,
                 senior_ids::text, caregiver_id, address, location_name, phone_number,
                 description, professional_name, preparation, documents_to_take,
                 transport_arrangement, recurrence::text, status, notes,
                 created_at, updated_at`,
      [
        id,
        input.householdId,
        input.title,
        input.type,
        input.date,
        input.time,
        input.duration ?? null,
        JSON.stringify(input.seniorIds),
        input.caregiverId ?? null,
        input.address ?? null,
        input.locationName ?? null,
        input.phoneNumber ?? null,
        input.description ?? null,
        input.professionalName ?? null,
        input.preparation ?? null,
        input.documentsToTake ?? null,
        input.transportArrangement ?? null,
        input.recurrence ? JSON.stringify(input.recurrence) : null,
        status,
        input.notes ?? null,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create appointment.');
    }

    return mapAppointment(row);
  }

  async updateAppointment(appointmentId: string, householdId: string, input: UpdateAppointmentInput): Promise<Appointment> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(input.type);
    }
    if (input.date !== undefined) {
      updates.push(`date = $${paramIndex++}`);
      values.push(input.date);
    }
    if (input.time !== undefined) {
      updates.push(`time = $${paramIndex++}`);
      values.push(input.time);
    }
    if (input.duration !== undefined) {
      updates.push(`duration = $${paramIndex++}`);
      values.push(input.duration);
    }
    if (input.seniorIds !== undefined) {
      updates.push(`senior_ids = $${paramIndex++}`);
      values.push(JSON.stringify(input.seniorIds));
    }
    if (input.caregiverId !== undefined) {
      updates.push(`caregiver_id = $${paramIndex++}`);
      values.push(input.caregiverId);
    }
    if (input.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(input.address);
    }
    if (input.locationName !== undefined) {
      updates.push(`location_name = $${paramIndex++}`);
      values.push(input.locationName);
    }
    if (input.phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramIndex++}`);
      values.push(input.phoneNumber);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.professionalName !== undefined) {
      updates.push(`professional_name = $${paramIndex++}`);
      values.push(input.professionalName);
    }
    if (input.preparation !== undefined) {
      updates.push(`preparation = $${paramIndex++}`);
      values.push(input.preparation);
    }
    if (input.documentsToTake !== undefined) {
      updates.push(`documents_to_take = $${paramIndex++}`);
      values.push(input.documentsToTake);
    }
    if (input.transportArrangement !== undefined) {
      updates.push(`transport_arrangement = $${paramIndex++}`);
      values.push(input.transportArrangement);
    }
    if (input.recurrence !== undefined) {
      updates.push(`recurrence = $${paramIndex++}`);
      values.push(input.recurrence ? JSON.stringify(input.recurrence) : null);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(input.notes);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(appointmentId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      title: string;
      type: AppointmentType;
      date: string | Date;
      time: string;
      duration: number | null;
      senior_ids: string;
      caregiver_id: string | null;
      address: string | null;
      location_name: string | null;
      phone_number: string | null;
      description: string | null;
      professional_name: string | null;
      preparation: string | null;
      documents_to_take: string | null;
      transport_arrangement: string | null;
      recurrence: string | null;
      status: AppointmentStatus;
      notes: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE appointments
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, household_id, title, type, date, time, duration,
                 senior_ids::text, caregiver_id, address, location_name, phone_number,
                 description, professional_name, preparation, documents_to_take,
                 transport_arrangement, recurrence::text, status, notes,
                 created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Appointment not found.');
    }

    return mapAppointment(row);
  }

  async deleteAppointment(appointmentId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM appointments
       WHERE id = $1 AND household_id = $2`,
      [appointmentId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Appointment not found.');
    }
  }

  // Appointment Reminders

  async listAppointmentReminders(appointmentId: string, householdId: string): Promise<AppointmentReminder[]> {
    const result = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.appointment_id, r.trigger_before, r.custom_message, r.enabled, r.created_at, r.updated_at
       FROM appointment_reminders r
       JOIN appointments a ON a.id = r.appointment_id
       WHERE r.appointment_id = $1 AND a.household_id = $2
       ORDER BY r.trigger_before DESC`,
      [appointmentId, householdId],
    );

    return result.rows.map(mapAppointmentReminder);
  }

  async getAppointmentReminderById(reminderId: string, appointmentId: string, householdId: string): Promise<AppointmentReminder | null> {
    const result = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.appointment_id, r.trigger_before, r.custom_message, r.enabled, r.created_at, r.updated_at
       FROM appointment_reminders r
       JOIN appointments a ON a.id = r.appointment_id
       WHERE r.id = $1 AND r.appointment_id = $2 AND a.household_id = $3
       LIMIT 1`,
      [reminderId, appointmentId, householdId],
    );

    const row = result.rows[0];
    return row ? mapAppointmentReminder(row) : null;
  }

  async createAppointmentReminder(input: CreateAppointmentReminderInput): Promise<AppointmentReminder> {
    const id = randomUUID();
    const now = nowIso();
    const enabled = input.enabled ?? true;

    const result = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO appointment_reminders (id, appointment_id, trigger_before, custom_message, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, appointment_id, trigger_before, custom_message, enabled, created_at, updated_at`,
      [id, input.appointmentId, input.triggerBefore, input.customMessage ?? null, enabled, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create appointment reminder.');
    }

    return mapAppointmentReminder(row);
  }

  async updateAppointmentReminder(reminderId: string, appointmentId: string, householdId: string, input: UpdateAppointmentReminderInput): Promise<AppointmentReminder> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.triggerBefore !== undefined) {
      updates.push(`trigger_before = $${paramIndex++}`);
      values.push(input.triggerBefore);
    }
    if (input.customMessage !== undefined) {
      updates.push(`custom_message = $${paramIndex++}`);
      values.push(input.customMessage);
    }
    if (input.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(input.enabled);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(reminderId);
    values.push(appointmentId);

    const result = await this.pool.query<{
      id: string;
      appointment_id: string;
      trigger_before: number;
      custom_message: string | null;
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE appointment_reminders r
       SET ${updates.join(', ')}
       FROM appointments a
       WHERE r.id = $${paramIndex++} AND r.appointment_id = $${paramIndex++} AND a.id = r.appointment_id AND a.household_id = $${paramIndex++}
       RETURNING r.id, r.appointment_id, r.trigger_before, r.custom_message, r.enabled, r.created_at, r.updated_at`,
      [...values, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Appointment reminder not found.');
    }

    return mapAppointmentReminder(row);
  }

  async deleteAppointmentReminder(reminderId: string, appointmentId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM appointment_reminders r
       USING appointments a
       WHERE r.id = $1 AND r.appointment_id = $2 AND a.id = r.appointment_id AND a.household_id = $3`,
      [reminderId, appointmentId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Appointment reminder not found.');
    }
  }

  // Appointment Occurrences

  async getOccurrenceById(occurrenceId: string, householdId: string): Promise<AppointmentOccurrence | null> {
    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
              status, overrides::text, created_at, updated_at
       FROM appointment_occurrences
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [occurrenceId, householdId],
    );

    const row = result.rows[0];
    return row ? mapOccurrence(row) : null;
  }

  async getOccurrenceByDate(appointmentId: string, occurrenceDate: string, householdId: string): Promise<AppointmentOccurrence | null> {
    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
              status, overrides::text, created_at, updated_at
       FROM appointment_occurrences
       WHERE recurring_appointment_id = $1 AND occurrence_date = $2 AND household_id = $3
       LIMIT 1`,
      [appointmentId, occurrenceDate, householdId],
    );

    const row = result.rows[0];
    return row ? mapOccurrence(row) : null;
  }

  async listOccurrences(appointmentId: string, householdId: string, fromDate?: string, toDate?: string): Promise<AppointmentOccurrence[]> {
    let query = `
      SELECT id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
             status, overrides::text, created_at, updated_at
      FROM appointment_occurrences
      WHERE recurring_appointment_id = $1 AND household_id = $2
    `;

    const params: unknown[] = [appointmentId, householdId];
    let paramIndex = 3;

    if (fromDate) {
      query += ` AND occurrence_date >= $${paramIndex++}`;
      params.push(fromDate);
    }

    if (toDate) {
      query += ` AND occurrence_date <= $${paramIndex++}`;
      params.push(toDate);
    }

    query += ` ORDER BY occurrence_date ASC, occurrence_time ASC`;

    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(query, params);

    return result.rows.map(mapOccurrence);
  }

  async createOccurrence(input: CreateOccurrenceInput): Promise<AppointmentOccurrence> {
    const id = randomUUID();
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO appointment_occurrences (
         id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
         status, overrides, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
                 status, overrides::text, created_at, updated_at`,
      [
        id,
        input.recurringAppointmentId,
        input.householdId,
        input.occurrenceDate,
        input.occurrenceTime,
        input.status,
        input.overrides ? JSON.stringify(input.overrides) : null,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create occurrence.');
    }

    return mapOccurrence(row);
  }

  async updateOccurrence(occurrenceId: string, householdId: string, input: UpdateOccurrenceInput): Promise<AppointmentOccurrence> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }
    if (input.overrides !== undefined) {
      updates.push(`overrides = $${paramIndex++}`);
      values.push(input.overrides ? JSON.stringify(input.overrides) : null);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(occurrenceId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      recurring_appointment_id: string;
      household_id: string;
      occurrence_date: string | Date;
      occurrence_time: string;
      status: 'scheduled' | 'modified' | 'cancelled' | 'completed' | 'missed';
      overrides: string | null;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE appointment_occurrences
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, recurring_appointment_id, household_id, occurrence_date, occurrence_time,
                 status, overrides::text, created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Occurrence not found.');
    }

    return mapOccurrence(row);
  }

  async deleteOccurrence(occurrenceId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM appointment_occurrences
       WHERE id = $1 AND household_id = $2`,
      [occurrenceId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Occurrence not found.');
    }
  }
}
