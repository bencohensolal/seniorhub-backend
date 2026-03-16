-- Documents feature
-- Creates tables for document folders and documents with hierarchical support

-- Create ENUM types
CREATE TYPE document_folder_type AS ENUM ('system_root', 'senior_folder', 'user_folder');
CREATE TYPE system_root_type AS ENUM ('medical', 'administrative');

-- document_folders table
CREATE TABLE document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type document_folder_type NOT NULL,
  senior_id UUID REFERENCES household_members(id) ON DELETE SET NULL,
  system_root_type system_root_type,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  -- Constraints
  CHECK (
    (type = 'system_root' AND system_root_type IS NOT NULL AND parent_folder_id IS NULL) OR
    (type != 'system_root' AND system_root_type IS NULL)
  ),
  CHECK (
    (type = 'senior_folder' AND senior_id IS NOT NULL) OR
    (type != 'senior_folder' AND senior_id IS NULL)
  ),
  -- Ensure system roots are unique per household per type
  UNIQUE (household_id, system_root_type) WHERE (type = 'system_root' AND deleted_at IS NULL),
  -- Ensure senior folder per senior per household is unique (only one senior folder per senior)
  UNIQUE (household_id, senior_id) WHERE (type = 'senior_folder' AND deleted_at IS NULL)
);

-- documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES document_folders(id) ON DELETE CASCADE,
  senior_id UUID REFERENCES household_members(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  original_filename VARCHAR(512) NOT NULL,
  storage_key VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  extension VARCHAR(10) NOT NULL,
  uploaded_by_user_id TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  -- Ensure storage_key is unique (though path-based)
  UNIQUE (storage_key) WHERE (deleted_at IS NULL)
);

-- Indexes for performance
CREATE INDEX idx_document_folders_household_parent ON document_folders (household_id, parent_folder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_folders_household_type ON document_folders (household_id, type) WHERE deleted_at IS NULL;
CREATE INDEX idx_document_folders_senior ON document_folders (senior_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_household_folder ON documents (household_id, folder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_household_senior ON documents (household_id, senior_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_storage_key ON documents (storage_key) WHERE deleted_at IS NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_document_folders_updated_at
  BEFORE UPDATE ON document_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert system roots for existing households (optional, can be lazy-created)
-- We'll create a function that can be called later
CREATE OR REPLACE FUNCTION ensure_document_system_roots_for_household(household_uuid UUID, user_id TEXT)
RETURNS VOID AS $$
BEGIN
  -- Insert Medical File root if not exists
  INSERT INTO document_folders (
    household_id,
    name,
    description,
    type,
    system_root_type,
    created_by_user_id
  ) VALUES (
    household_uuid,
    'Medical File',
    'A folder per senior with prescriptions, reports, insurance cards, and lab results.',
    'system_root',
    'medical',
    user_id
  ) ON CONFLICT (household_id, system_root_type) WHERE (type = 'system_root' AND deleted_at IS NULL) DO NOTHING;

  -- Insert Administrative root if not exists
  INSERT INTO document_folders (
    household_id,
    name,
    description,
    type,
    system_root_type,
    created_by_user_id
  ) VALUES (
    household_uuid,
    'Administrative',
    'Household administrative documents, bills, contracts, and personal files.',
    'system_root',
    'administrative',
    user_id
  ) ON CONFLICT (household_id, system_root_type) WHERE (type = 'system_root' AND deleted_at IS NULL) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
