-- Migration: Convert journal_entries from single senior_id to JSONB senior_ids array
-- Follows the same pattern as appointments.senior_ids

-- Step 1: Add the new JSONB column
ALTER TABLE journal_entries ADD COLUMN senior_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing data (convert single senior_id to array)
UPDATE journal_entries SET senior_ids = jsonb_build_array(senior_id::text);

-- Step 3: Drop the old column and its index
DROP INDEX IF EXISTS idx_journal_entries_senior;
ALTER TABLE journal_entries DROP COLUMN senior_id;

-- Step 4: Add constraints (same pattern as appointments)
ALTER TABLE journal_entries ADD CONSTRAINT valid_senior_ids CHECK (jsonb_typeof(senior_ids) = 'array');
ALTER TABLE journal_entries ADD CONSTRAINT min_one_senior CHECK (jsonb_array_length(senior_ids) >= 1);

-- Step 5: Recreate index for listing queries
CREATE INDEX idx_journal_entries_household_created ON journal_entries (household_id, created_at DESC);
