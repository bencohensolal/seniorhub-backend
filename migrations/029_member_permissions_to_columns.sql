-- 1. Add permission columns (default false, will be set by role in step 2)
ALTER TABLE household_members
  ADD COLUMN IF NOT EXISTS perm_manage_medications    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perm_manage_appointments   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perm_manage_tasks          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perm_manage_members        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perm_view_sensitive_info   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perm_view_documents        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS perm_manage_documents      BOOLEAN NOT NULL DEFAULT false;

-- 2. Set role-based defaults for ALL existing members
UPDATE household_members SET
  perm_manage_medications  = (role IN ('caregiver', 'intervenant')),
  perm_manage_appointments = (role IN ('caregiver', 'family', 'intervenant')),
  perm_manage_tasks        = (role IN ('caregiver', 'family')),
  perm_manage_members      = (role = 'caregiver'),
  perm_view_sensitive_info = (role IN ('caregiver', 'intervenant', 'senior')),
  perm_view_documents      = (role IN ('caregiver', 'family', 'intervenant', 'senior')),
  perm_manage_documents    = (role IN ('caregiver', 'intervenant'));

-- 3. Backfill customised permissions from household_settings JSONB (only if column still exists)
DO $$
DECLARE
  r RECORD;
  mp JSONB;
  col_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'household_settings' AND column_name = 'member_permissions'
  ) INTO col_exists;

  IF col_exists THEN
    FOR r IN
      SELECT hm.id, hs.member_permissions
      FROM household_members hm
      JOIN household_settings hs ON hs.household_id = hm.household_id
      WHERE hs.member_permissions IS NOT NULL
        AND hs.member_permissions != '{}'::jsonb
    LOOP
      mp := r.member_permissions -> r.id::text;
      IF mp IS NOT NULL THEN
        UPDATE household_members SET
          perm_manage_medications  = COALESCE((mp->>'manageMedications')::boolean,  perm_manage_medications),
          perm_manage_appointments = COALESCE((mp->>'manageAppointments')::boolean, perm_manage_appointments),
          perm_manage_tasks        = COALESCE((mp->>'manageTasks')::boolean,        perm_manage_tasks),
          perm_manage_members      = COALESCE((mp->>'manageMembers')::boolean,      perm_manage_members),
          perm_view_sensitive_info = COALESCE((mp->>'viewSensitiveInfo')::boolean,  perm_view_sensitive_info),
          perm_manage_documents    = COALESCE((mp->>'manageDocuments')::boolean,    perm_manage_documents),
          perm_view_documents      = COALESCE((mp->>'viewDocuments')::boolean,      perm_view_documents)
        WHERE id = r.id;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 4. Drop the now-redundant JSONB column
ALTER TABLE household_settings DROP COLUMN IF EXISTS member_permissions;
