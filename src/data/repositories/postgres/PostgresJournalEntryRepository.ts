import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  JournalEntry,
  JournalCategory,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
} from '../../../domain/entities/JournalEntry.js';
import type { JournalEntryRepository } from '../../../domain/repositories/JournalEntryRepository.js';
import {
  NotFoundError,
  ValidationError,
} from '../../../domain/errors/index.js';
import { nowIso, toIso } from './helpers.js';

type JournalEntryRow = {
  id: string;
  household_id: string;
  senior_id: string;
  author_id: string;
  content: string;
  category: JournalCategory;
  created_at: string | Date;
  updated_at: string | Date;
};

const mapJournalEntry = (row: JournalEntryRow): JournalEntry => ({
  id: row.id,
  householdId: row.household_id,
  seniorId: row.senior_id,
  authorId: row.author_id,
  content: row.content,
  category: row.category,
  createdAt: toIso(row.created_at),
  updatedAt: toIso(row.updated_at),
});

export class PostgresJournalEntryRepository implements JournalEntryRepository {
  constructor(protected readonly pool: Pool) {}

  async listByHousehold(
    householdId: string,
    filters?: {
      seniorId?: string;
      category?: JournalCategory;
      limit?: number;
      offset?: number;
    },
  ): Promise<JournalEntry[]> {
    let query = `
      SELECT id, household_id, senior_id, author_id, content, category,
             created_at, updated_at
      FROM journal_entries
      WHERE household_id = $1
    `;

    const params: unknown[] = [householdId];
    let paramIndex = 2;

    if (filters?.seniorId) {
      query += ` AND senior_id = $${paramIndex++}`;
      params.push(filters.seniorId);
    }

    if (filters?.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    query += ` ORDER BY created_at DESC`;

    const limit = filters?.limit ?? 50;
    query += ` LIMIT $${paramIndex++}`;
    params.push(limit);

    if (filters?.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }

    const result = await this.pool.query<JournalEntryRow>(query, params);

    return result.rows.map(mapJournalEntry);
  }

  async getById(id: string): Promise<JournalEntry | null> {
    const result = await this.pool.query<JournalEntryRow>(
      `SELECT id, household_id, senior_id, author_id, content, category,
              created_at, updated_at
       FROM journal_entries
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return mapJournalEntry(row);
  }

  async create(input: CreateJournalEntryInput): Promise<JournalEntry> {
    const id = randomUUID();
    const now = nowIso();
    const category = input.category || 'general';

    const result = await this.pool.query<JournalEntryRow>(
      `INSERT INTO journal_entries (
         id, household_id, senior_id, author_id, content, category,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING id, household_id, senior_id, author_id, content, category,
                 created_at, updated_at`,
      [
        id,
        input.householdId,
        input.seniorId,
        input.authorId,
        input.content,
        category,
        now,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Failed to create journal entry.');
    }

    return mapJournalEntry(row);
  }

  async update(id: string, input: UpdateJournalEntryInput): Promise<JournalEntry> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (input.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(input.content);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update.');
    }

    const now = nowIso();
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);

    values.push(id);

    const result = await this.pool.query<JournalEntryRow>(
      `UPDATE journal_entries
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++}
       RETURNING id, household_id, senior_id, author_id, content, category,
                 created_at, updated_at`,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError('Journal entry not found.');
    }

    return mapJournalEntry(row);
  }

  async delete(id: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM journal_entries
       WHERE id = $1`,
      [id],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Journal entry not found.');
    }
  }
}
