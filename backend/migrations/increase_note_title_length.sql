-- Migration: Increase global_notes title length limit
-- Date: 2025-01-XX
-- Description: Changes title column from VARCHAR(255) to TEXT to allow unlimited length titles

-- Change title column to TEXT (unlimited length)
ALTER TABLE global_notes 
ALTER COLUMN title TYPE TEXT;

