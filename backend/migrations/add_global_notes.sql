-- Migration: Add global_notes table
-- Date: 2025-01-XX
-- Description: Adds table for free-form notes not tied to specific dates

-- Global notes table (free-form notes not tied to specific dates)
CREATE TABLE IF NOT EXISTS global_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_notes_user_id ON global_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_global_notes_updated_at ON global_notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_notes_user_updated ON global_notes(user_id, updated_at DESC);

-- Trigger to update updated_at for global_notes
CREATE TRIGGER update_global_notes_updated_at
    BEFORE UPDATE ON global_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE global_notes IS 'Free-form notes not tied to specific dates - thoughts, ideas, planning, "second brain"';

