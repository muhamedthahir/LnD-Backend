-- Migration: Add level_id and category_id to question_banks table
-- Run this script in your dev MySQL database

-- Add level_id column
ALTER TABLE question_banks 
ADD COLUMN level_id INT NULL AFTER status_id;

-- Add category_id column
ALTER TABLE question_banks 
ADD COLUMN category_id INT NULL AFTER level_id;

-- Add foreign key constraints
ALTER TABLE question_banks 
ADD CONSTRAINT fk_question_banks_level 
FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE SET NULL;

ALTER TABLE question_banks 
ADD CONSTRAINT fk_question_banks_category 
FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- Add indexes for better query performance
CREATE INDEX idx_question_banks_level_id ON question_banks(level_id);
CREATE INDEX idx_question_banks_category_id ON question_banks(category_id);

-- Verify the changes
DESCRIBE question_banks;

