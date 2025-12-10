-- Migration: Add degree column to users table
-- Run this to add the degree field

ALTER TABLE users 
  ADD COLUMN degree VARCHAR(255) NULL AFTER section;

