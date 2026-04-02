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
      ...(input.description ? { description: input.description } : {}),
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

    const updates: Partial<JournalEntry> = {};
    if (input.seniorIds !== undefined) updates.seniorIds = input.seniorIds;
    if (input.content !== undefined) updates.content = input.content;
    if (input.description !== undefined) updates.description = input.description ?? undefined;
    if (input.category !== undefined) updates.category = input.category;

    if (Object.keys(updates).length === 0) throw new ValidationError('No fields to update.');

    this.entries[idx] = { ...this.entries[idx], ...updates, updatedAt: nowIso() };
    return this.entries[idx];
  }

  async delete(id: string): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1) throw new NotFoundError('Journal entry not found.');
    this.entries.splice(idx, 1);
  }

  async archive(id: string): Promise<JournalEntry> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1 || this.entries[idx].archivedAt) {
      throw new NotFoundError('Journal entry not found or already archived.');
    }
    this.entries[idx] = { ...this.entries[idx], archivedAt: nowIso(), updatedAt: nowIso() };
    return this.entries[idx];
  }

  async unarchive(id: string): Promise<JournalEntry> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx === -1 || !this.entries[idx].archivedAt) {
      throw new NotFoundError('Journal entry not found or not archived.');
    }
    const { archivedAt: _, ...rest } = this.entries[idx];
    this.entries[idx] = { ...rest, updatedAt: nowIso() } as JournalEntry;
    return this.entries[idx];
  }
}
