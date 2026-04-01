-- Migration 040: Add 'care' category and archiving support to journal entries

-- Add 'care' category (Soins)
ALTER TYPE journal_category ADD VALUE 'care';

-- Add archiving support
ALTER TABLE journal_entries ADD COLUMN archived_at TIMESTAMPTZ;

CREATE INDEX idx_journal_entries_archived ON journal_entries(household_id, archived_at);

COMMENT ON COLUMN journal_entries.archived_at IS 'When set, the entry is archived and excluded from active count and plan limits';
