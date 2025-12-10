-- Migration: Update groups table to add degree and passout_year fields
-- Remove section field (no longer needed)
-- Run this ONLY if the groups table already exists

ALTER TABLE `groups` 
  ADD COLUMN degree VARCHAR(255) NULL AFTER college_name,
  ADD COLUMN passout_year INT NULL AFTER department;

-- Note: section column is kept for backward compatibility but is no longer used
-- You can drop it later if needed:
-- ALTER TABLE groups DROP COLUMN section;

