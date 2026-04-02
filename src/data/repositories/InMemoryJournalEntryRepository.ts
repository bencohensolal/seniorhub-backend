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
    const entry: JournalEntry = Object.assign(
      {
        id: randomUUID(),
        householdId: input.householdId,
        seniorIds: input.seniorIds,
        authorId: input.authorId,
        content: input.content,
        category: input.category || 'general' as JournalCategory,
        createdAt: now,
        updatedAt: now,
      },
      input.description != null ? { description: input.description } : {},
    );
    this.entries.push(entry);
    return entry;
  }

  async update(id: string, input: UpdateJournalEntryInput): Promise<JournalEntry> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new NotFoundError('Journal entry not found.');

    const existing = this.entries[idx]!;
    let hasChanges = false;

    const base: JournalEntry = {
      id: existing.id,
      householdId: existing.householdId,
      seniorIds: existing.seniorIds,
      authorId: existing.authorId,
      content: existing.content,
      category: existing.category,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };

    if (existing.description != null) base.description = existing.description;
    if (existing.archivedAt != null) base.archivedAt = existing.archivedAt;

    if (input.seniorIds !== undefined) { base.seniorIds = input.seniorIds; hasChanges = true; }
    if (input.content !== undefined) { base.content = input.content; hasChanges = true; }
    if (input.category !== undefined) { base.category = input.category; hasChanges = true; }
    if (input.description !== undefined) {
      if (input.description === null) {
        delete base.description;
      } else {
        base.description = input.description;
      }
      hasChanges = true;
    }

    if (!hasChanges) throw new ValidationError('No fields to update.');

    this.entries[idx] = base;
    return base;
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
    const updated: JournalEntry = {
      id: entry.id,
      householdId: entry.householdId,
      seniorIds: entry.seniorIds,
      authorId: entry.authorId,
      content: entry.content,
      category: entry.category,
      createdAt: entry.createdAt,
      archivedAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (entry.description != null) updated.description = entry.description;
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
      category: entry.category,
      createdAt: entry.createdAt,
      updatedAt: nowIso(),
    };
    if (entry.description != null) updated.description = entry.description;
    this.entries[idx] = updated;
    return updated;
  }
}
