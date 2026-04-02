import { randomUUID } from 'node:crypto';
import type {
  JournalEntry,
  JournalCategory,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
} from '../../domain/entities/JournalEntry.js';
import type { JournalEntryRepository } from '../../domain/repositories/JournalEntryRepository.js';
import { NotFoundError, ValidationError } from '../../domain/errors/index.js';

const nowIso = () => new Date().toISOString();

export class InMemoryJournalEntryRepository implements JournalEntryRepository {
  private entries: JournalEntry[] = [];

  async listByHousehold(
    householdId: string,
    filters?: {
      seniorId?: string;
      category?: JournalCategory;
      archived?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<JournalEntry[]> {
    let result = this.entries.filter((e) => e.householdId === householdId);

    if (filters?.archived === true) {
      result = result.filter((e) => e.archivedAt != null);
    } else {
      result = result.filter((e) => e.archivedAt == null);
    }

    if (filters?.seniorId) {
      result = result.filter((e) => e.seniorIds.includes(filters.seniorId!));
    }
    if (filters?.category) {
      result = result.filter((e) => e.category === filters.category);
    }

    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;
    return result.slice(offset, offset + limit);
  }

  async getById(id: string): Promise<JournalEntry | null> {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  async create(input: CreateJournalEntryInput): Promise<JournalEntry> {
    const now = nowIso();
    const entry: JournalEntry = {
      id: randomUUID(),
      householdId: input.householdId,
      seniorIds: input.seniorIds,
      authorId: input.authorId,
      content: input.content,
      description: input.description,
      category: input.category || 'general',
      createdAt: now,
      updatedAt: now,
    };
    this.entries.push(entry);
    return entry;
  }

  async update(id: string, input: UpdateJournalEntryInput): Promise<JournalEntry> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new NotFoundError('Journal entry not found.');

    const existing = this.entries[idx]!;
    const updated: JournalEntry = {
      id: existing.id,
      householdId: existing.householdId,
      seniorIds: input.seniorIds !== undefined ? input.seniorIds : existing.seniorIds,
      authorId: existing.authorId,
      content: input.content !== undefined ? input.content : existing.content,
      description: input.description !== undefined ? (input.description ?? undefined) : existing.description,
      category: input.category !== undefined ? input.category : existing.category,
      archivedAt: existing.archivedAt,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };

    if (
      updated.seniorIds === existing.seniorIds &&
      updated.content === existing.content &&
      updated.description === existing.description &&
      updated.category === existing.category
    ) {
      throw new ValidationError('No fields to update.');
    }

    this.entries[idx] = updated;
    return updated;
  }

  async delete(id: string): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new NotFoundError('Journal entry not found.');
    this.entries.splice(idx, 1);
  }

  async archive(id: string): Promise<JournalEntry> {
    const idx = this.entries.findIndex((e) => e.id === id);
    const entry = this.entries[idx];
    if (idx === -1 || !entry || entry.archivedAt) {
      throw new NotFoundError('Journal entry not found or already archived.');
    }
    const updated: JournalEntry = { ...entry, archivedAt: nowIso(), updatedAt: nowIso() };
    this.entries[idx] = updated;
    return updated;
  }

  async unarchive(id: string): Promise<JournalEntry> {
    const idx = this.entries.findIndex((e) => e.id === id);
    const entry = this.entries[idx];
    if (idx === -1 || !entry || !entry.archivedAt) {
      throw new NotFoundError('Journal entry not found or not archived.');
    }
    const updated: JournalEntry = {
      id: entry.id,
      householdId: entry.householdId,
      seniorIds: entry.seniorIds,
      authorId: entry.authorId,
      content: entry.content,
      description: entry.description,
      category: entry.category,
      createdAt: entry.createdAt,
      updatedAt: nowIso(),
    };
    this.entries[idx] = updated;
    return updated;
  }
}
