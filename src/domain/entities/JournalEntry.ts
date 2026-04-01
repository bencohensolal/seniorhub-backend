export type JournalCategory = 'general' | 'mood' | 'meal' | 'outing' | 'visit' | 'incident' | 'other';

export interface JournalEntry {
  id: string;
  householdId: string;
  seniorId: string;
  authorId: string;
  content: string;
  description?: string;
  category: JournalCategory;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJournalEntryInput {
  householdId: string;
  seniorId: string;
  authorId: string;
  content: string;
  description?: string;
  category?: JournalCategory;
}

export interface UpdateJournalEntryInput {
  content?: string;
  description?: string | null;
  category?: JournalCategory;
}
