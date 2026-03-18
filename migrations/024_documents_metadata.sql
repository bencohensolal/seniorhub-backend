-- Add metadata fields to documents for better organization
-- Fields: description, event_date, category, tags

-- Add description column (optional text description)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description TEXT;

-- Add event_date column (optional date for the document's related event, e.g., lab result date)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS event_date DATE;

-- Add category column (optional categorization)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- Add tags column (optional array of tags for flexible categorization)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index for searching by category
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents (household_id, category) WHERE deleted_at IS NULL AND category IS NOT NULL;

-- Create index for searching by event_date
CREATE INDEX IF NOT EXISTS idx_documents_event_date ON documents (household_id, event_date) WHERE deleted_at IS NULL AND event_date IS NOT NULL;

-- Create GIN index for tags array search
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN (tags) WHERE deleted_at IS NULL AND array_length(tags, 1) > 0;

-- Comment on columns for documentation
COMMENT ON COLUMN documents.description IS 'Optional user-provided description of the document';
COMMENT ON COLUMN documents.event_date IS 'Optional date of the event related to the document (e.g., lab result date, appointment date)';
COMMENT ON COLUMN documents.category IS 'Optional category for the document (e.g., prescription, lab_result, insurance, invoice)';
COMMENT ON COLUMN documents.tags IS 'Optional array of tags for flexible categorization';