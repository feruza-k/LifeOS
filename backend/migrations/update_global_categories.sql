-- Migration: Update Global Categories
-- Date: 2025-12-28
-- Description: Replace old global categories with new set: Social, Self, Work, Growth, Essentials

-- Step 1: Delete old global categories that are not in the new set
-- Only delete if they are truly global (user_id IS NULL) and not in our new list
DELETE FROM categories 
WHERE user_id IS NULL 
AND label NOT IN ('Social', 'Self', 'Work', 'Growth', 'Essentials')
AND label IN ('Health', 'Family', 'Creativity');

-- Step 2: Update existing global categories to new colors if they exist
UPDATE categories 
SET color = CASE label
    WHEN 'Work' THEN '#A5BBC6'
    WHEN 'Growth' THEN '#B6A8C7'
    WHEN 'Social' THEN '#EAA4A6'
    WHEN 'Self' THEN '#A2C1A8'
    WHEN 'Essentials' THEN '#DBC599'
END
WHERE user_id IS NULL 
AND label IN ('Work', 'Growth', 'Social', 'Self', 'Essentials');

-- Step 3: Insert new global categories that don't exist yet
-- Use ON CONFLICT to handle cases where categories might already exist
INSERT INTO categories (id, label, color, user_id) 
SELECT 
    uuid_generate_v4(),
    label,
    color,
    NULL
FROM (VALUES
    ('Social', '#EAA4A6'),
    ('Self', '#A2C1A8'),
    ('Work', '#A5BBC6'),
    ('Growth', '#B6A8C7'),
    ('Essentials', '#DBC599')
) AS new_cats(label, color)
WHERE NOT EXISTS (
    SELECT 1 FROM categories 
    WHERE categories.user_id IS NULL 
    AND categories.label = new_cats.label
);

