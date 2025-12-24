-- Migration: Create global_notes table
-- Date: 2025-01-XX
-- Description: Creates the global_notes table if it doesn't exist

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Global Notes table (free-form notes not tied to specific dates)
CREATE TABLE IF NOT EXISTS global_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_global_notes_user_id ON global_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_global_notes_updated_at ON global_notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_notes_user_updated ON global_notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_global_notes_title ON global_notes(title);

-- Trigger to update updated_at for global_notes
-- First, ensure the function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_global_notes_updated_at ON global_notes;
CREATE TRIGGER update_global_notes_updated_at
    BEFORE UPDATE ON global_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE global_notes IS 'Free-form notes not tied to specific dates - thoughts, ideas, planning, "second brain"';

