-- Question Bank System Schema
-- Run this SQL script to create all necessary tables for question bank

-- 1. Level table (Master)
CREATE TABLE IF NOT EXISTS levels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  `rank` INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_rank (`rank`)
);

-- 2. Status table (Master)
CREATE TABLE IF NOT EXISTS statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

-- 3. QuestionType table (Master)
CREATE TABLE IF NOT EXISTS question_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

-- 4. Category table (Master - self-referencing)
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id INT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_name (name),
  INDEX idx_parent_id (parent_id),
  INDEX idx_active (active)
);

-- 5. Tag table (Master)
CREATE TABLE IF NOT EXISTS tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

-- 6. Language table (Master)
CREATE TABLE IF NOT EXISTS languages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  current_version VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_is_active (is_active)
);

-- 7. QuestionBank table
CREATE TABLE IF NOT EXISTS question_banks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  institution_id INT NULL,
  status_id INT NOT NULL,
  level_id INT NULL,
  category_id INT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  updated_by INT NULL,
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL,
  FOREIGN KEY (status_id) REFERENCES statuses(id),
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_name (name),
  INDEX idx_institution_id (institution_id),
  INDEX idx_status_id (status_id),
  INDEX idx_level_id (level_id),
  INDEX idx_category_id (category_id),
  INDEX idx_active (active)
);

-- 8. QuestionBankTag junction table
CREATE TABLE IF NOT EXISTS question_bank_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_bank_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_bank_id) REFERENCES question_banks(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE KEY unique_question_bank_tag (question_bank_id, tag_id),
  INDEX idx_question_bank_id (question_bank_id),
  INDEX idx_tag_id (tag_id)
);

-- 9. Question table (Base)
CREATE TABLE IF NOT EXISTS questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  level_id INT NULL,
  question_type_id INT NOT NULL,
  question_bank_id INT NULL,
  category_id INT NULL,
  status_id INT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  points INT DEFAULT 1,
  negative_marks INT DEFAULT 0,
  time_to_solve INT NULL,
  explanation TEXT,
  hint TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by INT NULL,
  updated_by INT NULL,
  FOREIGN KEY (level_id) REFERENCES levels(id) ON DELETE SET NULL,
  FOREIGN KEY (question_type_id) REFERENCES question_types(id),
  FOREIGN KEY (question_bank_id) REFERENCES question_banks(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (status_id) REFERENCES statuses(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_code (code),
  INDEX idx_name (name),
  INDEX idx_level_id (level_id),
  INDEX idx_question_type_id (question_type_id),
  INDEX idx_question_bank_id (question_bank_id),
  INDEX idx_category_id (category_id),
  INDEX idx_status_id (status_id),
  INDEX idx_active (active)
);

-- 10. QuestionTag junction table
CREATE TABLE IF NOT EXISTS question_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE KEY unique_question_tag (question_id, tag_id),
  INDEX idx_question_id (question_id),
  INDEX idx_tag_id (tag_id)
);

-- 11. MCQMultiSelectQuestion table (extends Question)
CREATE TABLE IF NOT EXISTS mcq_multiselect_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL UNIQUE,
  is_multi_select BOOLEAN DEFAULT FALSE,
  min_select_required INT NULL,
  max_select_allowed INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  INDEX idx_question_id (question_id)
);

-- 12. Option table (for MCQ & Multi-Select)
CREATE TABLE IF NOT EXISTS options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mcq_multiselect_question_id INT NOT NULL,
  text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  `order` INT NOT NULL DEFAULT 0,
  explanation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_multiselect_question_id) REFERENCES mcq_multiselect_questions(id) ON DELETE CASCADE,
  INDEX idx_mcq_question_id (mcq_multiselect_question_id),
  INDEX idx_order (`order`)
);

-- 13. ProgrammingQuestion table (extends Question)
CREATE TABLE IF NOT EXISTS programming_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL UNIQUE,
  time_limit INT NULL,
  memory_limit INT NULL,
  threshold INT NULL,
  no_of_submission_allowed INT NULL,
  no_of_testcase_to_be_passed INT NULL,
  constraints TEXT,
  sample_input TEXT,
  sample_output TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  INDEX idx_question_id (question_id)
);

-- 14. ProgrammingQuestionLanguage junction table
CREATE TABLE IF NOT EXISTS programming_question_languages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  programming_question_id INT NOT NULL,
  language_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (programming_question_id) REFERENCES programming_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_prog_question_language (programming_question_id, language_id),
  INDEX idx_programming_question_id (programming_question_id),
  INDEX idx_language_id (language_id)
);

-- 15. TestCase table
CREATE TABLE IF NOT EXISTS test_cases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  programming_question_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  input TEXT NOT NULL,
  expected_result TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_hidden BOOLEAN DEFAULT FALSE,
  should_match_exactly BOOLEAN DEFAULT TRUE,
  percentage_of_match INT DEFAULT 100,
  `order` INT DEFAULT 0,
  weight INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (programming_question_id) REFERENCES programming_questions(id) ON DELETE CASCADE,
  INDEX idx_programming_question_id (programming_question_id),
  INDEX idx_is_active (is_active),
  INDEX idx_order (`order`)
);

-- 16. CodeTemplate table (Starter Code)
CREATE TABLE IF NOT EXISTS code_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  programming_question_id INT NOT NULL,
  language_id INT NOT NULL,
  template_code TEXT NOT NULL,
  solution_code TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (programming_question_id) REFERENCES programming_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (language_id) REFERENCES languages(id) ON DELETE CASCADE,
  UNIQUE KEY unique_template_language (programming_question_id, language_id),
  INDEX idx_programming_question_id (programming_question_id),
  INDEX idx_language_id (language_id)
);

