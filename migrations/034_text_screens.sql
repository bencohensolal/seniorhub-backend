-- Text screens for display tablets
-- Allows caregivers to create custom text-based screens with styling options

CREATE TABLE text_screens (
  id VARCHAR(50) PRIMARY KEY,
  tablet_id UUID NOT NULL REFERENCES display_tablets(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  body TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,

  -- Typography
  font_family VARCHAR(20) NOT NULL DEFAULT 'sans-serif',
  font_size VARCHAR(10) NOT NULL DEFAULT 'medium',
  text_color VARCHAR(7) NOT NULL DEFAULT '#1E293B',
  text_align VARCHAR(10) NOT NULL DEFAULT 'center',

  -- Background
  background_type VARCHAR(10) NOT NULL DEFAULT 'solid',
  background_color VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
  background_color_end VARCHAR(7),
  gradient_direction VARCHAR(20) DEFAULT 'to-bottom',

  -- Decoration
  icon VARCHAR(50),
  animation VARCHAR(20) NOT NULL DEFAULT 'none',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_text_screens_tablet ON text_screens(tablet_id);
CREATE INDEX idx_text_screens_household ON text_screens(household_id);
