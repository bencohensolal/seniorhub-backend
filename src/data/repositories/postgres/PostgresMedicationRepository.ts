import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { CreateMedicationInput, Medication, MedicationForm, UpdateMedicationInput } from '../../../domain/entities/Medication.js';
import type { MedicationReminder, CreateReminderInput, UpdateReminderInput } from '../../../domain/entities/MedicationReminder.js';
import type { MedicationLog, CreateMedicationLogInput } from '../../../domain/entities/MedicationLog.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import {
  nowIso,
  mapMedication,
  mapReminder,
  mapMedicationLog,
} from './helpers.js';

export class PostgresMedicationRepository {
  constructor(protected readonly pool: Pool) {}

  async listHouseholdMedications(householdId: string): Promise<Medication[]> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, senior_id, name, dosage, form, frequency,
              prescribed_by, prescription_date, start_date, end_date, instructions,
              created_by_user_id, created_at, updated_at
       FROM medications
       WHERE household_id = $1
       ORDER BY name ASC`,
      [householdId],
    );

    return result.rows.map(mapMedication);
  }

  async getMedicationById(medicationId: string, householdId: string): Promise<Medication | null> {
    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT id, household_id, senior_id, name, dosage, form, frequency,
              prescribed_by, prescription_date, start_date, end_date, instructions,
              created_by_user_id, created_at, updated_at
       FROM medications
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [medicationId, householdId],
    );

    const row = result.rows[0];
    return row ? mapMedication(row) : null;
  }

  async createMedication(input: CreateMedicationInput): Promise<Medication> {
    const id = randomUUID();
    const now = nowIso();

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO medications (
         id, household_id, senior_id, name, dosage, form, frequency,
         prescribed_by, prescription_date, start_date, end_date, instructions,
         created_by_user_id, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
       RETURNING id, household_id, senior_id, name, dosage, form, frequency,
                 prescribed_by, prescription_date, start_date, end_date, instructions,
                 created_by_user_id, created_at, updated_at`,
      [
        id,
        input.householdId,
        input.seniorId,
        input.name,
        input.dosage,
        input.form,
        input.frequency,
        input.prescribedBy ?? null,
        input.prescriptionDate ?? null,
        input.startDate,
        input.endDate ?? null,
        input.instructions ?? null,
        input.createdByUserId,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create medication.');
    }

    return mapMedication(row);
  }

  async updateMedication(medicationId: string, householdId: string, input: UpdateMedicationInput): Promise<Medication> {
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.dosage !== undefined) {
      updates.push(`dosage = $${paramIndex++}`);
      values.push(input.dosage);
    }
    if (input.form !== undefined) {
      updates.push(`form = $${paramIndex++}`);
      values.push(input.form);
    }
    if (input.frequency !== undefined) {
      updates.push(`frequency = $${paramIndex++}`);
      values.push(input.frequency);
    }
    if (input.prescribedBy !== undefined) {
      updates.push(`prescribed_by = $${paramIndex++}`);
      values.push(input.prescribedBy);
    }
    if (input.prescriptionDate !== undefined) {
      updates.push(`prescription_date = $${paramIndex++}`);
      values.push(input.prescriptionDate);
    }
    if (input.startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(input.startDate);
    }
    if (input.endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(input.endDate);
    }
    if (input.instructions !== undefined) {
      updates.push(`instructions = $${paramIndex++}`);
      values.push(input.instructions);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(medicationId);
    values.push(householdId);

    const result = await this.pool.query<{
      id: string;
      household_id: string;
      senior_id: string;
      name: string;
      dosage: string;
      form: MedicationForm;
      frequency: string;
      prescribed_by: string | null;
      prescription_date: string | Date | null;
      start_date: string | Date;
      end_date: string | Date | null;
      instructions: string | null;
      created_by_user_id: string;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE medications
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, household_id, senior_id, name, dosage, form, frequency,
                 prescribed_by, prescription_date, start_date, end_date, instructions,
                 created_by_user_id, created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Medication not found.');
    }

    return mapMedication(row);
  }

  async deleteMedication(medicationId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM medications
       WHERE id = $1 AND household_id = $2`,
      [medicationId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Medication not found.');
    }
  }

  // Medication Reminders

  async listMedicationReminders(medicationId: string, householdId: string): Promise<MedicationReminder[]> {
    const result = await this.pool.query<{
      id: string;
      medication_id: string;
      time: string;
      days_of_week: number[];
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.medication_id, r.time, r.days_of_week, r.enabled, r.created_at, r.updated_at
       FROM medication_reminders r
       JOIN medications m ON m.id = r.medication_id
       WHERE r.medication_id = $1 AND m.household_id = $2
       ORDER BY r.time ASC`,
      [medicationId, householdId],
    );

    return result.rows.map(mapReminder);
  }

  async getReminderById(reminderId: string, medicationId: string, householdId: string): Promise<MedicationReminder | null> {
    const result = await this.pool.query<{
      id: string;
      medication_id: string;
      time: string;
      days_of_week: number[];
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT r.id, r.medication_id, r.time, r.days_of_week, r.enabled, r.created_at, r.updated_at
       FROM medication_reminders r
       JOIN medications m ON m.id = r.medication_id
       WHERE r.id = $1 AND r.medication_id = $2 AND m.household_id = $3
       LIMIT 1`,
      [reminderId, medicationId, householdId],
    );

    const row = result.rows[0];
    return row ? mapReminder(row) : null;
  }

  async createReminder(input: CreateReminderInput): Promise<MedicationReminder> {
    const id = randomUUID();
    const now = nowIso();
    const enabled = input.enabled ?? true;

    const result = await this.pool.query<{
      id: string;
      medication_id: string;
      time: string;
      days_of_week: number[];
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `INSERT INTO medication_reminders (id, medication_id, time, days_of_week, enabled, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING id, medication_id, time, days_of_week, enabled, created_at, updated_at`,
      [id, input.medicationId, input.time, input.daysOfWeek, enabled, now],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create reminder.');
    }

    return mapReminder(row);
  }

  async updateReminder(reminderId: string, medicationId: string, householdId: string, input: UpdateReminderInput): Promise<MedicationReminder> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.time !== undefined) {
      updates.push(`time = $${paramIndex++}`);
      values.push(input.time);
    }
    if (input.daysOfWeek !== undefined) {
      updates.push(`days_of_week = $${paramIndex++}`);
      values.push(input.daysOfWeek);
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
    values.push(medicationId);

    const result = await this.pool.query<{
      id: string;
      medication_id: string;
      time: string;
      days_of_week: number[];
      enabled: boolean;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `UPDATE medication_reminders r
       SET ${updates.join(', ')}
       FROM medications m
       WHERE r.id = $${paramIndex++} AND r.medication_id = $${paramIndex++} AND m.id = r.medication_id AND m.household_id = $${paramIndex++}
       RETURNING r.id, r.medication_id, r.time, r.days_of_week, r.enabled, r.created_at, r.updated_at`,
      [...values, householdId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Reminder not found.');
    }

    return mapReminder(row);
  }

  async deleteReminder(reminderId: string, medicationId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM medication_reminders r
       USING medications m
       WHERE r.id = $1 AND r.medication_id = $2 AND m.id = r.medication_id AND m.household_id = $3`,
      [reminderId, medicationId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Reminder not found.');
    }
  }

  // Medication Logs

  async createMedicationLog(input: CreateMedicationLogInput): Promise<MedicationLog> {
    const id = randomUUID();
    const now = nowIso();

    // Idempotence : si un log existe déjà pour ce (medication_id, scheduled_date, scheduled_time), le retourner
    // Normalise scheduledTime to "HH:MM" (5 chars max) — l'API peut renvoyer "HH:MM:SS"
    const scheduledTime = input.scheduledTime ? input.scheduledTime.slice(0, 5) : null;

    const existing = await this.pool.query<{ id: string }>(
      `SELECT id FROM medication_logs
       WHERE medication_id = $1
         AND scheduled_date = $2
         AND (scheduled_time = $3 OR (scheduled_time IS NULL AND $3 IS NULL))
       LIMIT 1`,
      [input.medicationId, input.scheduledDate, scheduledTime],
    );
    if (existing.rows[0]) {
      const row = await this.pool.query(
        `SELECT * FROM medication_logs WHERE id = $1`,
        [existing.rows[0].id],
      );
      return mapMedicationLog(row.rows[0]);
    }

    const result = await this.pool.query(
      `INSERT INTO medication_logs
         (id, medication_id, household_id, scheduled_date, scheduled_time, taken_at, taken_by_user_id, note, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        input.medicationId,
        input.householdId,
        input.scheduledDate,
        scheduledTime,
        input.takenAt,
        input.takenByUserId ?? null,
        input.note ?? null,
        now,
      ],
    );
    return mapMedicationLog(result.rows[0]);
  }

  async getMedicationLogs(householdId: string, date: string): Promise<MedicationLog[]> {
    const result = await this.pool.query(
      `SELECT * FROM medication_logs
       WHERE household_id = $1 AND scheduled_date = $2
       ORDER BY taken_at ASC`,
      [householdId, date],
    );
    return result.rows.map(mapMedicationLog);
  }
}
