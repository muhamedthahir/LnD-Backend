-- Migration: Add missing assessment_user_mappings columns
-- Adds proctoring refresh violation counter and timing/progress fields

ALTER TABLE assessment_user_mappings
  ADD COLUMN current_question_index INT DEFAULT 0,
  ADD COLUMN time_remaining INT DEFAULT 0,
  ADD COLUMN segment_time_remaining INT DEFAULT 0,
  ADD COLUMN attempt_count INT DEFAULT 1,
  ADD COLUMN refresh_violation_count INT DEFAULT 1;


