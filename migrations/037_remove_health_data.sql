-- Migration 037: Remove health data for non-HDS compliance
-- Purpose: Transform app from health-focused to daily life organization
-- Changes:
--   1. Drop medications module entirely (tables + types)
--   2. Create journal_entries (carnet de liaison) to replace medications
--   3. Transform appointments from medical types to free tags
--   4. Transform documents from medical to personal
--   5. Remove health-related privacy settings
--   6. Rename medication permission to journal permission

-- ============================================================
-- 1. DROP MEDICATIONS MODULE
-- ============================================================

DROP TABLE IF EXISTS caregiver_medication_alerts;
DROP TABLE IF EXISTS medication_logs;
DROP TABLE IF EXISTS medication_reminders;
DROP TABLE IF EXISTS medications;
DROP TYPE IF EXISTS medication_form;

-- ============================================================
-- 2. CREATE JOURNAL (CARNET DE LIAISON)
-- ============================================================

CREATE TYPE journal_category AS ENUM (
  'general',
  'mood',
  'meal',
  'outing',
  'visit',
  'incident',
  'other'
);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  senior_id UUID NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  category journal_category NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_household ON journal_entries(household_id);
CREATE INDEX idx_journal_entries_senior ON journal_entries(household_id, senior_id, created_at DESC);
CREATE INDEX idx_journal_entries_category ON journal_entries(household_id, category);

COMMENT ON TABLE journal_entries IS 'Shared care journal (carnet de liaison) entries between household caregivers';
COMMENT ON COLUMN journal_entries.senior_id IS 'The senior this entry is about';
COMMENT ON COLUMN journal_entries.author_id IS 'The household member who wrote this entry';
COMMENT ON COLUMN journal_entries.category IS 'Optional category for filtering entries';

-- ============================================================
-- 3. TRANSFORM APPOINTMENTS (medical types → free tags)
-- ============================================================

ALTER TABLE appointments ADD COLUMN tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE appointments DROP COLUMN type;
DROP TYPE IF EXISTS appointment_type;

ALTER TABLE appointments RENAME COLUMN professional_name TO contact_name;
ALTER TABLE appointments DROP COLUMN preparation;
ALTER TABLE appointments RENAME COLUMN documents_to_take TO items_to_take;

COMMENT ON TABLE appointments IS 'Stores appointments for household members';

-- ============================================================
-- 4. TRANSFORM DOCUMENTS (medical → personal)
-- ============================================================

-- Recreate system_root_type enum: replace 'medical' with 'personal'
-- Step 1: Change column to VARCHAR temporarily
ALTER TABLE document_folders ALTER COLUMN system_root_type TYPE VARCHAR(50) USING system_root_type::text;

-- Step 2: Update data
UPDATE document_folders SET system_root_type = 'personal', name = 'Personal Documents', description = 'Personal documents organized by senior'
  WHERE system_root_type = 'medical';

-- Step 3: Drop old enum and create new one
DROP TYPE IF EXISTS system_root_type;
CREATE TYPE system_root_type AS ENUM ('personal', 'administrative');

-- Step 4: Convert column back to enum
ALTER TABLE document_folders ALTER COLUMN system_root_type TYPE system_root_type USING system_root_type::system_root_type;

-- Update the function that creates system roots for new households
CREATE OR REPLACE FUNCTION ensure_document_system_roots_for_household(household_uuid UUID, user_id TEXT)
RETURNS VOID AS $$
BEGIN
  -- Insert Personal Documents root if not exists
  INSERT INTO document_folders (
    household_id,
    name,
    description,
    type,
    system_root_type,
    created_by_user_id
  )
  SELECT
    household_uuid,
    'Personal Documents',
    'Personal documents organized by senior.',
    'system_root',
    'personal',
    user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM document_folders
    WHERE household_id = household_uuid
      AND system_root_type = 'personal'
      AND type = 'system_root'
      AND deleted_at IS NULL
  );

  -- Insert Administrative root if not exists
  INSERT INTO document_folders (
    household_id,
    name,
    description,
    type,
    system_root_type,
    created_by_user_id
  )
  SELECT
    household_uuid,
    'Administrative',
    'Household administrative documents, bills, contracts, and personal files.',
    'system_root',
    'administrative',
    user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM document_folders
    WHERE household_id = household_uuid
      AND system_root_type = 'administrative'
      AND type = 'system_root'
      AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. REMOVE HEALTH PRIVACY SETTING
-- ============================================================

ALTER TABLE user_privacy_settings DROP COLUMN IF EXISTS share_health_data;

-- ============================================================
-- 6. RENAME MEDICATION PERMISSION TO JOURNAL
-- ============================================================

ALTER TABLE household_members RENAME COLUMN perm_manage_medications TO perm_manage_journal;
