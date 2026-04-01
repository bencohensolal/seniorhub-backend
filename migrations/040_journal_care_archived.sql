-- Migration 040: Add 'care' category and archiving support to journal entries

-- Add 'care' category (Soins) - idempotent
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'care' AND enumtypid = 'journal_category'::regtype) THEN
    ALTER TYPE journal_category ADD VALUE 'care';
  END IF;
END $$;

-- Add archiving support - idempotent
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_journal_entries_archived ON journal_entries(household_id, archived_at);

COMMENT ON COLUMN journal_entries.archived_at IS 'When set, the entry is archived and excluded from active count and plan limits';
