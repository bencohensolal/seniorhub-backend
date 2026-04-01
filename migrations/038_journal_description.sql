-- Migration 038: Add optional description field to journal entries
-- Allows caregivers to add detailed descriptions alongside short notes

ALTER TABLE journal_entries ADD COLUMN description TEXT;

COMMENT ON COLUMN journal_entries.description IS 'Optional long-form description for the journal entry';
