-- Migration: Photo Screens for Display Tablets
-- Description: Add support for photo gallery screens on display tablets
-- Tables:
--   - photo_screens: Metadata for photo gallery screens
--   - photos: Individual photos within a photo screen

-- Create photo_screens table
CREATE TABLE photo_screens (
  id VARCHAR(50) PRIMARY KEY,
  tablet_id UUID NOT NULL,
  household_id UUID NOT NULL,
  name VARCHAR(50) NOT NULL,
  display_mode VARCHAR(20) NOT NULL DEFAULT 'slideshow',
  slideshow_duration INTEGER DEFAULT 5,
  slideshow_transition VARCHAR(20) DEFAULT 'fade',
  slideshow_order VARCHAR(20) DEFAULT 'sequential',
  show_captions BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(50) NOT NULL,
  updated_at TIMESTAMP,
  FOREIGN KEY (tablet_id) REFERENCES display_tablets(id) ON DELETE CASCADE,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  -- Constraints
  CONSTRAINT check_display_mode CHECK (display_mode IN ('slideshow', 'mosaic', 'single')),
  CONSTRAINT check_slideshow_duration CHECK (slideshow_duration IN (3, 5, 10, 15, 30)),
  CONSTRAINT check_slideshow_transition CHECK (slideshow_transition IN ('fade', 'slide', 'none')),
  CONSTRAINT check_slideshow_order CHECK (slideshow_order IN ('sequential', 'random'))
);

-- Create indexes for photo_screens
CREATE INDEX idx_photo_screens_tablet ON photo_screens(tablet_id);
CREATE INDEX idx_photo_screens_household ON photo_screens(household_id);
CREATE INDEX idx_photo_screens_created_at ON photo_screens(created_at DESC);

-- Create photos table
CREATE TABLE photos (
  id VARCHAR(50) PRIMARY KEY,
  photo_screen_id VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  caption VARCHAR(100),
  display_order INTEGER NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP,
  FOREIGN KEY (photo_screen_id) REFERENCES photo_screens(id) ON DELETE CASCADE,
  -- Constraints
  CONSTRAINT check_display_order CHECK (display_order >= 0 AND display_order <= 5)
);

-- Create indexes for photos
CREATE INDEX idx_photos_screen ON photos(photo_screen_id);
CREATE INDEX idx_photos_order ON photos(photo_screen_id, display_order);

-- Note: Constraints like "max 5 photo screens per tablet" and "max 6 photos per screen"
-- are enforced at the application level for better error handling and performance.
