-- Migration: Add order_index to monthly_focus and remove unique constraint
-- This allows multiple goals per month (up to 5)

-- Step 1: Add order_index column with default value
ALTER TABLE monthly_focus 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Step 2: Add check constraint for order_index (0-4)
ALTER TABLE monthly_focus
DROP CONSTRAINT IF EXISTS monthly_focus_order_check;

ALTER TABLE monthly_focus
ADD CONSTRAINT monthly_focus_order_check CHECK (order_index >= 0 AND order_index < 5);

-- Step 3: Remove unique constraint on (user_id, month)
ALTER TABLE monthly_focus
DROP CONSTRAINT IF EXISTS monthly_focus_user_id_month_key;

-- Step 4: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_monthly_focus_user_month_order 
ON monthly_focus(user_id, month, order_index);

-- Step 5: Update existing records to have order_index = 0
UPDATE monthly_focus 
SET order_index = 0 
WHERE order_index IS NULL OR order_index = 0;

