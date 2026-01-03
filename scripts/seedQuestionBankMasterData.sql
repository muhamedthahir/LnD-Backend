-- ========================================
-- Question Bank Master Data Seed Script
-- ========================================
-- Run this script in your MySQL database to seed master data

-- 1. Seed Levels
INSERT INTO levels (name, description, `rank`) VALUES 
  ('Easy', 'Beginner level questions', 1),
  ('Medium', 'Intermediate level questions', 2),
  ('Hard', 'Advanced level questions', 3)
ON DUPLICATE KEY UPDATE 
  description = VALUES(description), 
  `rank` = VALUES(`rank`);

-- 2. Seed Statuses
INSERT INTO statuses (name, description) VALUES 
  ('DRAFT', 'Question is in draft state and not published'),
  ('REVIEW', 'Question is under review'),
  ('PUBLISHED', 'Question is published and available for use')
ON DUPLICATE KEY UPDATE 
  description = VALUES(description);

-- 3. Seed Question Types
INSERT INTO question_types (name, description) VALUES 
  ('MCQ', 'Multiple Choice Question with single correct answer'),
  ('Multi Select', 'Multiple Choice Question with multiple correct answers'),
  ('Programming', 'Programming/Coding question with test cases')
ON DUPLICATE KEY UPDATE 
  description = VALUES(description);

-- 4. Seed Languages
INSERT INTO languages (name, description, current_version) VALUES 
  ('Python', 'Python programming language', '3.11'),
  ('Java', 'Java programming language', '17'),
  ('JavaScript', 'JavaScript programming language', 'ES2022'),
  ('C', 'C programming language', 'C17'),
  ('C++', 'C++ programming language', 'C++20'),
  ('C#', 'C# programming language', '11'),
  ('Go', 'Go programming language', '1.21'),
  ('Ruby', 'Ruby programming language', '3.2'),
  ('PHP', 'PHP programming language', '8.2'),
  ('TypeScript', 'TypeScript programming language', '5.0')
ON DUPLICATE KEY UPDATE 
  description = VALUES(description), 
  current_version = VALUES(current_version);

-- 5. Seed Categories
INSERT INTO categories (name, description) VALUES 
  ('Data Structures', 'Questions related to data structures'),
  ('Algorithms', 'Questions related to algorithms'),
  ('Database', 'Questions related to databases and SQL'),
  ('Web Development', 'Questions related to web development'),
  ('Object Oriented Programming', 'Questions related to OOP concepts'),
  ('General Programming', 'General programming questions')
ON DUPLICATE KEY UPDATE 
  description = VALUES(description);

-- 6. Seed Tags
INSERT INTO tags (name, color) VALUES 
  ('Easy', '#22c55e'),
  ('Medium', '#f59e0b'),
  ('Hard', '#ef4444'),
  ('Interview', '#6366f1'),
  ('Practice', '#8b5cf6'),
  ('Assessment', '#ec4899'),
  ('Beginner', '#14b8a6'),
  ('Advanced', '#f97316')
ON DUPLICATE KEY UPDATE 
  color = VALUES(color);

-- ========================================
-- Verify seeded data (optional)
-- ========================================
SELECT 'Levels' as `Table`, COUNT(*) as `Count` FROM levels
UNION ALL
SELECT 'Statuses', COUNT(*) FROM statuses
UNION ALL
SELECT 'Question Types', COUNT(*) FROM question_types
UNION ALL
SELECT 'Languages', COUNT(*) FROM languages
UNION ALL
SELECT 'Categories', COUNT(*) FROM categories
UNION ALL
SELECT 'Tags', COUNT(*) FROM tags;

