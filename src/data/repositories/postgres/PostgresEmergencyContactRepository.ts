import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { EmergencyContact, CreateEmergencyContactInput, UpdateEmergencyContactInput } from '../../../domain/entities/EmergencyContact.js';
import { NotFoundError } from '../../../domain/errors/index.js';
import { nowIso, toIso } from './helpers.js';

type EmergencyContactRow = {
  id: string;
  household_id: string;
  name: string;
  phone: string;
  relationship: string | null;
  priority_order: number;
  created_at: string | Date;
  updated_at: string | Date;
};

function mapEmergencyContact(row: EmergencyContactRow): EmergencyContact {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    phone: row.phone,
    relationship: row.relationship,
    priorityOrder: row.priority_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export class PostgresEmergencyContactRepository {
  constructor(protected readonly pool: Pool) {}

  async listEmergencyContacts(householdId: string): Promise<EmergencyContact[]> {
    const result = await this.pool.query<EmergencyContactRow>(
      `SELECT id, household_id, name, phone, relationship, priority_order, created_at, updated_at
       FROM emergency_contacts
       WHERE household_id = $1
       ORDER BY priority_order ASC, created_at ASC`,
      [householdId],
    );
    return result.rows.map(mapEmergencyContact);
  }

  async getEmergencyContactById(contactId: string, householdId: string): Promise<EmergencyContact | null> {
    const result = await this.pool.query<EmergencyContactRow>(
      `SELECT id, household_id, name, phone, relationship, priority_order, created_at, updated_at
       FROM emergency_contacts
       WHERE id = $1 AND household_id = $2
       LIMIT 1`,
      [contactId, householdId],
    );
    const row = result.rows[0];
    return row ? mapEmergencyContact(row) : null;
  }

  async createEmergencyContact(input: CreateEmergencyContactInput): Promise<EmergencyContact> {
    const id = randomUUID();
    const now = nowIso();

    const result = await this.pool.query<EmergencyContactRow>(
      `INSERT INTO emergency_contacts (id, household_id, name, phone, relationship, priority_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id, household_id, name, phone, relationship, priority_order, created_at, updated_at`,
      [
        id,
        input.householdId,
        input.name,
        input.phone,
        input.relationship ?? null,
        input.priorityOrder,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create emergency contact.');
    }

    return mapEmergencyContact(row);
  }

  async updateEmergencyContact(contactId: string, householdId: string, input: UpdateEmergencyContactInput): Promise<EmergencyContact> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    if (input.phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(input.phone);
    }
    if (input.relationship !== undefined) {
      updates.push(`relationship = $${paramIndex++}`);
      values.push(input.relationship);
    }
    if (input.priorityOrder !== undefined) {
      updates.push(`priority_order = $${paramIndex++}`);
      values.push(input.priorityOrder);
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(contactId);
    values.push(householdId);

    const result = await this.pool.query<EmergencyContactRow>(
      `UPDATE emergency_contacts
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND household_id = $${paramIndex++}
       RETURNING id, household_id, name, phone, relationship, priority_order, created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Emergency contact not found.');
    }

    return mapEmergencyContact(row);
  }

  async deleteEmergencyContact(contactId: string, householdId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM emergency_contacts
       WHERE id = $1 AND household_id = $2`,
      [contactId, householdId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Emergency contact not found.');
    }
  }

  async reorderEmergencyContacts(householdId: string, orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.pool.query(
        `UPDATE emergency_contacts
         SET priority_order = $1, updated_at = $2
         WHERE id = $3 AND household_id = $4`,
        [i, nowIso(), orderedIds[i], householdId],
      );
    }
  }

  async getCaregiverPushTokens(householdId: string): Promise<string[]> {
    const result = await this.pool.query<{ token: string }>(
      `SELECT upt.token
       FROM user_push_tokens upt
       JOIN household_members hm ON hm.user_id = upt.user_id
       WHERE hm.household_id = $1 AND hm.role = 'caregiver' AND hm.status = 'active'`,
      [householdId],
    );
    return result.rows.map(row => row.token);
  }
}
