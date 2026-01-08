-- Migration: Add threshold_value to segments and has_to_go_by_section to courses
-- Run this SQL script to add the new columns

-- Add threshold_value column to segments table (default 100%)
ALTER TABLE segments 
ADD COLUMN threshold_value INT DEFAULT 100 
COMMENT 'Completion threshold percentage for video/audio lessons (0-100)';

-- Add has_to_go_by_section column to courses table (default false)
ALTER TABLE courses 
ADD COLUMN has_to_go_by_section BOOLEAN DEFAULT FALSE 
COMMENT 'If true, users must complete topics sequentially before moving to the next';

-- Update existing segments to have default threshold_value of 100
UPDATE segments SET threshold_value = 100 WHERE threshold_value IS NULL;

-- Update existing courses to have has_to_go_by_section as false
UPDATE courses SET has_to_go_by_section = FALSE WHERE has_to_go_by_section IS NULL;


