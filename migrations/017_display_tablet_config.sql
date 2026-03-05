-- Migration: Display Tablet Configuration
-- Purpose: Add config JSON column to display_tablets table for storing tablet display settings
-- This allows per-tablet customization of slide durations, screens, and screen-specific settings

ALTER TABLE display_tablets
  ADD COLUMN config JSONB;

-- Add comment for documentation
COMMENT ON COLUMN display_tablets.config IS 'JSON configuration for tablet display settings (slide duration, screens, screen settings). NULL means use default config.';

-- Note: No default value or NOT NULL constraint - tablets without config will use client-side defaults
-- This allows backward compatibility and reduces database storage for tablets using default settings
