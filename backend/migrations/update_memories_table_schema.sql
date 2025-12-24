-- Migration: Update memories table schema for Day 24 Memory Extraction
-- Date: 2025-12-24
-- Description: Updates memories table to support new memory extraction system with content, memory_type, confidence, source, and extra_data

-- Step 1: Add new columns (if they don't exist)
DO $$ 
BEGIN
    -- Add content column (rename from text if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memories' AND column_name = 'content') THEN
        -- If text column exists, rename it to content
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memories' AND column_name = 'text') THEN
            ALTER TABLE memories RENAME COLUMN text TO content;
        ELSE
            -- If neither exists, add content
            ALTER TABLE memories ADD COLUMN content TEXT NOT NULL DEFAULT '';
        END IF;
    END IF;

    -- Add memory_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memories' AND column_name = 'memory_type') THEN
        ALTER TABLE memories ADD COLUMN memory_type VARCHAR(20);
    END IF;

    -- Add confidence column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memories' AND column_name = 'confidence') THEN
        ALTER TABLE memories ADD COLUMN confidence NUMERIC(3, 2);
    END IF;

    -- Add source column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memories' AND column_name = 'source') THEN
        ALTER TABLE memories ADD COLUMN source VARCHAR(50) DEFAULT 'conversation';
    END IF;

    -- Add extra_data column (JSONB)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memories' AND column_name = 'extra_data') THEN
        ALTER TABLE memories ADD COLUMN extra_data JSONB;
    END IF;
END $$;

-- Step 2: Set defaults for existing rows
UPDATE memories 
SET 
    memory_type = 'preference',
    confidence = 0.75,
    source = 'conversation'
WHERE memory_type IS NULL OR confidence IS NULL OR source IS NULL;

-- Step 3: Make columns NOT NULL where required (after setting defaults)
ALTER TABLE memories 
    ALTER COLUMN content SET NOT NULL,
    ALTER COLUMN memory_type SET NOT NULL,
    ALTER COLUMN confidence SET NOT NULL,
    ALTER COLUMN source SET NOT NULL;

-- Step 4: Add check constraints
DO $$
BEGIN
    -- memory_type constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'memories_type_check'
    ) THEN
        ALTER TABLE memories 
        ADD CONSTRAINT memories_type_check 
        CHECK (memory_type IN ('preference', 'constraint', 'pattern', 'value'));
    END IF;

    -- confidence constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'memories_confidence_check'
    ) THEN
        ALTER TABLE memories 
        ADD CONSTRAINT memories_confidence_check 
        CHECK (confidence >= 0.00 AND confidence <= 1.00);
    END IF;

    -- source constraint
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'memories_source_check'
    ) THEN
        ALTER TABLE memories 
        ADD CONSTRAINT memories_source_check 
        CHECK (source IN ('conversation', 'pattern_analysis', 'explicit', 'user_import'));
    END IF;
END $$;

-- Step 5: Update updated_at trigger if needed
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
DROP TRIGGER IF EXISTS update_memories_updated_at ON memories;
CREATE TRIGGER update_memories_updated_at
    BEFORE UPDATE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Add comment
COMMENT ON TABLE memories IS 'Long-term memories extracted from conversations - preferences, constraints, patterns, values';

