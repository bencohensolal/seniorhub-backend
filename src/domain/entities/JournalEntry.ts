export type JournalCategory = 'general' | 'mood' | 'meal' | 'outing' | 'visit' | 'incident' | 'care' | 'other';

export interface JournalEntry {
  id: string;
  householdId: string;
  seniorIds: string[];
  authorId: string;
  content: string;
  description?: string;
  category: JournalCategory;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJournalEntryInput {
  householdId: string;
  seniorIds: string[];
  authorId: string;
  content: string;
  description?: string;
  category?: JournalCategory;
}

export interface UpdateJournalEntryInput {
  seniorIds?: string[];
  content?: string;
  description?: string | null;
  category?: JournalCategory;
}
