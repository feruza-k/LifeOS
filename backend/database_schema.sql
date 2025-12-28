-- LifeOS PostgreSQL Schema
-- Migration from JSON storage to PostgreSQL
-- Generated: December 18, 2025

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table (authentication & profile)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    avatar_path VARCHAR(500),
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    refresh_token TEXT,
    refresh_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_verification_token ON users(verification_token);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_users_refresh_token ON users(refresh_token);

-- Categories table (user-defined or system defaults)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label VARCHAR(100) NOT NULL,
    color VARCHAR(7) NOT NULL, -- Hex color code
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, label) -- Each user can have unique category labels
);

CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Tasks table (events and reminders)
-- RULE: datetime is the single source of truth for task scheduling.
-- For date-only queries, use DATE(datetime) in application code or the generated column below.
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('event', 'reminder')),
    title VARCHAR(500) NOT NULL,
    -- Single source of truth for task scheduling
    datetime TIMESTAMP NOT NULL,
    -- Optional end time for tasks with duration
    end_datetime TIMESTAMP,
    duration_minutes INTEGER,
    -- Generated column for date-only queries (derived from datetime)
    date DATE GENERATED ALWAYS AS (DATE(datetime)) STORED,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    category VARCHAR(100), -- Fallback category string (for migration)
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    energy VARCHAR(20) CHECK (energy IN ('low', 'medium', 'high')),
    context VARCHAR(50), -- work, home, laptop, outside, errand
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    moved_from TIMESTAMP, -- Original datetime if task was moved (changed from DATE)
    recurring VARCHAR(50), -- Legacy recurring field
    -- Recurring task configuration (stored as JSONB for flexibility)
    repeat_config JSONB,
    -- Data integrity constraints
    CONSTRAINT check_end_after_start CHECK (end_datetime IS NULL OR end_datetime >= datetime),
    CONSTRAINT check_duration_positive CHECK (duration_minutes IS NULL OR duration_minutes > 0)
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_datetime ON tasks(datetime);
CREATE INDEX idx_tasks_date ON tasks(date); -- Index on generated column for date queries
CREATE INDEX idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX idx_tasks_user_datetime ON tasks(user_id, datetime); -- For range queries
CREATE INDEX idx_tasks_completed ON tasks(completed);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_category_id ON tasks(category_id);
-- Composite index for common query: incomplete tasks for user
CREATE INDEX idx_tasks_user_completed_datetime ON tasks(user_id, completed, datetime)
WHERE completed = FALSE; -- Partial index (smaller, faster for incomplete tasks)

-- Check-ins table (daily reflections)
-- PURPOSE: Structured daily reflection - task completion tracking, mood, structured reflection.
-- Use this for: end-of-day check-ins, task completion summaries, structured self-reflection.
-- NOTE: This table uses denormalized arrays (completed_task_ids, incomplete_task_ids)
-- for performance and simplicity in v1. This is intentional denormalization.
-- Future consideration: If you need relational integrity or complex queries on task-checkin
-- relationships, consider a junction table (task_checkins) instead.
CREATE TABLE checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    -- Denormalized arrays: intentionally denormalized for v1 performance
    -- See comment above for future migration path if needed
    completed_task_ids UUID[] DEFAULT '{}',
    incomplete_task_ids UUID[] DEFAULT '{}',
    moved_tasks JSONB DEFAULT '[]', -- Array of {taskId, newDate}
    note TEXT,
    mood VARCHAR(10), -- Emoji mood (e.g., "😊", "😌", "😐", "😴")
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date) -- One check-in per user per day
);

CREATE INDEX idx_checkins_user_id ON checkins(user_id);
CREATE INDEX idx_checkins_date ON checkins(date);
CREATE INDEX idx_checkins_user_date ON checkins(user_id, date);

-- Notes table (daily notes with optional photo)
-- PURPOSE: Factual daily notes - what happened, facts, observations.
-- Use this for: daily logs, factual records, photo captions, objective notes.
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    photo_filename VARCHAR(500), -- Reference to photo file
    photo_uploaded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, date) -- One note per user per day
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_date ON notes(date);
CREATE INDEX idx_notes_user_date ON notes(user_id, date);

-- Reminders table (separate from tasks)
-- NOTE: due_date and time can be used independently:
-- - Date-only reminders: set due_date, leave time NULL
-- - Time-only reminders: set time, leave due_date NULL
-- - Full datetime reminders: set both (combine in application code)
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    due_date DATE,
    time TIME,
    type VARCHAR(20) CHECK (type IN ('notify', 'show')),
    recurring VARCHAR(20) CHECK (recurring IN ('daily', 'weekly', 'monthly', 'yearly')),
    visible BOOLEAN DEFAULT TRUE,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_due_date ON reminders(due_date);
CREATE INDEX idx_reminders_user_due_date ON reminders(user_id, due_date);

-- Diary entries table (free emotional journaling)
-- PURPOSE: Free-form emotional journaling - feelings, thoughts, unstructured reflection.
-- Use this for: emotional processing, free writing, unstructured thoughts, personal journaling.
-- NOTE: This is distinct from notes (factual) and checkins (structured reflection).
CREATE TABLE diary_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_diary_user_id ON diary_entries(user_id);
CREATE INDEX idx_diary_created_at ON diary_entries(created_at);

-- Memories table (long-term personal preferences and extracted memories)
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    memory_type VARCHAR(20) NOT NULL CHECK (memory_type IN ('preference', 'constraint', 'pattern', 'value')),
    confidence NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0.00 AND confidence <= 1.00),
    source VARCHAR(50) NOT NULL DEFAULT 'conversation' CHECK (source IN ('conversation', 'pattern_analysis', 'explicit', 'user_import')),
    extra_data JSONB,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_memory_type ON memories(memory_type);
CREATE INDEX idx_memories_user_type ON memories(user_id, memory_type);

-- Trigger to update updated_at for memories
CREATE TRIGGER update_memories_updated_at
    BEFORE UPDATE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Monthly focus table (monthly goals/focus areas)
CREATE TABLE monthly_focus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- YYYY-MM format
    title VARCHAR(500) NOT NULL,
    description TEXT,
    progress INTEGER CHECK (progress >= 0 AND progress <= 100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, month) -- One focus per user per month
);

CREATE INDEX idx_monthly_focus_user_id ON monthly_focus(user_id);
CREATE INDEX idx_monthly_focus_month ON monthly_focus(month);
CREATE INDEX idx_monthly_focus_user_month ON monthly_focus(user_id, month);

-- Global notes table (free-form notes not tied to specific dates)
CREATE TABLE global_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_global_notes_user_id ON global_notes(user_id);
CREATE INDEX idx_global_notes_updated_at ON global_notes(updated_at DESC);
CREATE INDEX idx_global_notes_user_updated ON global_notes(user_id, updated_at DESC);

-- Trigger to update updated_at for global_notes
CREATE TRIGGER update_global_notes_updated_at
    BEFORE UPDATE ON global_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Context Signals table (weekly cached signals for SolAI behavior adaptation)
CREATE TABLE context_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    signals_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, week_start)
);

CREATE INDEX idx_context_signals_user_id ON context_signals(user_id);
CREATE INDEX idx_context_signals_week_start ON context_signals(week_start DESC);
CREATE INDEX idx_context_signals_user_week ON context_signals(user_id, week_start DESC);

-- Trigger to update updated_at for context_signals
CREATE TRIGGER update_context_signals_updated_at
    BEFORE UPDATE ON context_signals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUDIT & SYSTEM TABLES
-- ============================================================================

-- Audit log table (for authentication events)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- login, logout, signup, password_reset, verification, lockout
    ip_address VARCHAR(45), -- IPv6 compatible
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Pending actions table (for confirmation workflows)
CREATE TABLE pending_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- reschedule, edit, delete, etc.
    action_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_pending_actions_user_id ON pending_actions(user_id);
CREATE INDEX idx_pending_actions_expires_at ON pending_actions(expires_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON reminders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monthly_focus_updated_at BEFORE UPDATE ON monthly_focus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS (Optional - for admin/debug queries only)
-- ============================================================================
-- WARNING: These views are for convenience and admin/debugging purposes only.
-- DO NOT use these views in core application logic or bind frontend to them.
-- They may change or be removed in the future. Always query tables directly in production code.
-- ============================================================================

-- View for today's tasks (admin/debug only)
CREATE OR REPLACE VIEW tasks_today AS
SELECT t.*, u.email as user_email
FROM tasks t
JOIN users u ON t.user_id = u.id
WHERE t.date = CURRENT_DATE
ORDER BY t.datetime NULLS LAST, t.created_at;

-- View for upcoming tasks (admin/debug only)
CREATE OR REPLACE VIEW tasks_upcoming AS
SELECT t.*, u.email as user_email
FROM tasks t
JOIN users u ON t.user_id = u.id
WHERE t.datetime > CURRENT_TIMESTAMP
ORDER BY t.datetime;

-- View for overdue tasks (admin/debug only)
CREATE OR REPLACE VIEW tasks_overdue AS
SELECT t.*, u.email as user_email
FROM tasks t
JOIN users u ON t.user_id = u.id
WHERE t.datetime < CURRENT_TIMESTAMP
  AND t.completed = FALSE
ORDER BY t.datetime;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts with authentication and profile information';
COMMENT ON TABLE categories IS 'Task categories with colors (can be user-specific or system defaults)';
COMMENT ON TABLE tasks IS 'Events and reminders with scheduling information. datetime is the single source of truth for scheduling.';
COMMENT ON TABLE checkins IS 'Structured daily reflection with task completion tracking. Denormalized arrays are intentional for v1.';
COMMENT ON TABLE notes IS 'Factual daily notes - what happened, facts, observations. Distinct from checkins (structured) and diary (emotional).';
COMMENT ON TABLE reminders IS 'Standalone reminders (separate from tasks). due_date and time can be used independently: date-only (time=NULL), time-only (due_date=NULL), or both combined in application code.';
COMMENT ON TABLE diary_entries IS 'Free-form emotional journaling - feelings, thoughts, unstructured reflection. Distinct from notes (factual) and checkins (structured).';
COMMENT ON TABLE memories IS 'Long-term personal preferences and memories';
COMMENT ON TABLE monthly_focus IS 'Monthly goals and focus areas';
COMMENT ON TABLE global_notes IS 'Free-form notes not tied to specific dates - thoughts, ideas, planning, "second brain"';
COMMENT ON TABLE audit_logs IS 'Authentication and security event audit trail';
COMMENT ON TABLE pending_actions IS 'Pending user confirmations for assistant actions';

-- ============================================================================
-- INITIAL DATA (Optional - for default categories)
-- ============================================================================

-- Insert default categories (system-wide, user_id = NULL)
-- These can be used as templates or defaults for new users
INSERT INTO categories (id, label, color, user_id) VALUES
    (uuid_generate_v4(), 'Social', '#EAA4A6', NULL),
    (uuid_generate_v4(), 'Self', '#A2C1A8', NULL),
    (uuid_generate_v4(), 'Work', '#A5BBC6', NULL),
    (uuid_generate_v4(), 'Growth', '#B6A8C7', NULL),
    (uuid_generate_v4(), 'Essentials', '#DBC599', NULL)
ON CONFLICT DO NOTHING;

