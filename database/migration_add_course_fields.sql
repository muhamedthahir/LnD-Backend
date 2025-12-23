-- Migration to add new fields to courses table
-- Run this migration to add category, competency_level, short_description, course_outcomes, status, and thumbnail columns

ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS category VARCHAR(255) NULL AFTER description,
ADD COLUMN IF NOT EXISTS competency_level VARCHAR(50) NULL AFTER category,
ADD COLUMN IF NOT EXISTS short_description TEXT NULL AFTER competency_level,
ADD COLUMN IF NOT EXISTS course_outcomes TEXT NULL AFTER short_description,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft' AFTER course_outcomes,
ADD COLUMN IF NOT EXISTS thumbnail VARCHAR(500) NULL AFTER status;

-- Update existing courses to have default status
UPDATE courses SET status = 'draft' WHERE status IS NULL;


