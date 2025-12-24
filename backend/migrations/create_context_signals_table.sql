-- Migration: Create context_signals table
-- Date: 2025-01-XX
-- Description: Creates the context_signals table for Day 24 - Context Awareness Signals (Foundation Only)

-- Context Signals table (weekly cached signals for SolAI behavior adaptation)
CREATE TABLE IF NOT EXISTS context_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    signals_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, week_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_context_signals_user_id ON context_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_context_signals_week_start ON context_signals(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_context_signals_user_week ON context_signals(user_id, week_start DESC);

-- Trigger to update updated_at for context_signals
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
DROP TRIGGER IF EXISTS update_context_signals_updated_at ON context_signals;
CREATE TRIGGER update_context_signals_updated_at
    BEFORE UPDATE ON context_signals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE context_signals IS 'Weekly cached context signals for SolAI behavior adaptation - foundation only, no UI';

