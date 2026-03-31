import type {
  JournalEntry,
  JournalCategory,
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
} from '../entities/JournalEntry.js';

export interface JournalEntryRepository {
  listByHousehold(
    householdId: string,
    filters?: {
      seniorId?: string;
      category?: JournalCategory;
      limit?: number;
      offset?: number;
    },
  ): Promise<JournalEntry[]>;

  getById(id: string): Promise<JournalEntry | null>;

  create(input: CreateJournalEntryInput): Promise<JournalEntry>;

  update(id: string, input: UpdateJournalEntryInput): Promise<JournalEntry>;

  delete(id: string): Promise<void>;
}
