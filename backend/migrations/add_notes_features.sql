-- Migration: Add features to global_notes (pinned, archived, audio, images) and increase title length
-- Date: 2025-01-XX
-- Description: Adds pinned, archived, audio_filename, and image_filename columns to global_notes
-- Also changes title column from VARCHAR(255) to TEXT to allow unlimited length titles
-- Removes tags column if it exists

-- Change title column to TEXT (unlimited length) - do this first
ALTER TABLE global_notes 
ALTER COLUMN title TYPE TEXT;

-- Add pinned column (default false)
ALTER TABLE global_notes 
ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE NOT NULL;

-- Add archived column (default false)
ALTER TABLE global_notes 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE NOT NULL;

-- Remove tags column if it exists (feature removed)
ALTER TABLE global_notes 
DROP COLUMN IF EXISTS tags;

-- Drop tags index if it exists
DROP INDEX IF EXISTS idx_global_notes_tags;

-- Add audio_filename column for voice notes
ALTER TABLE global_notes 
ADD COLUMN IF NOT EXISTS audio_filename VARCHAR(500);

-- Add image_filename column for note images
ALTER TABLE global_notes 
ADD COLUMN IF NOT EXISTS image_filename VARCHAR(500);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_global_notes_pinned ON global_notes(user_id, pinned) WHERE pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_global_notes_archived ON global_notes(user_id, archived) WHERE archived = FALSE;

-- Add comments
COMMENT ON COLUMN global_notes.pinned IS 'Whether the note is pinned to the top';
COMMENT ON COLUMN global_notes.archived IS 'Whether the note is archived (hidden from main view)';
COMMENT ON COLUMN global_notes.audio_filename IS 'Filename of attached voice note audio file';
COMMENT ON COLUMN global_notes.image_filename IS 'Filename of attached image file';

