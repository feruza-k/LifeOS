-- Migration: Add title field to global_notes
-- Date: 2025-01-XX
-- Description: Adds title/name field to global_notes for better organization

-- Add title column (nullable for existing notes, will be generated from content)
ALTER TABLE global_notes 
ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Create index for title searches
CREATE INDEX IF NOT EXISTS idx_global_notes_title ON global_notes(title);

-- Update existing notes: extract first line as title (up to 50 chars)
UPDATE global_notes 
SET title = LEFT(TRIM(SPLIT_PART(content, E'\n', 1)), 50)
WHERE title IS NULL OR title = '';

-- Set default title for empty notes
UPDATE global_notes 
SET title = 'Untitled Note'
WHERE title IS NULL OR title = '';

