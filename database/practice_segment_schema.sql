-- Practice Segment Schema
-- This table stores practice problems/exercises linked to a topic (section)

-- 1. Practice Segment table
CREATE TABLE IF NOT EXISTS practice_segments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unique_id VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  topic_id INT NOT NULL,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_unique_id (unique_id),
  INDEX idx_topic_id (topic_id),
  INDEX idx_name (name)
);

-- 2. Practice Segment Programming Questions junction table
CREATE TABLE IF NOT EXISTS practice_segment_programming_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  practice_segment_id INT NOT NULL,
  question_id INT NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (practice_segment_id) REFERENCES practice_segments(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_practice_programming_question (practice_segment_id, question_id),
  INDEX idx_practice_segment_id (practice_segment_id),
  INDEX idx_question_id (question_id)
);

-- 3. Practice Segment MCQ Questions junction table
CREATE TABLE IF NOT EXISTS practice_segment_mcq_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  practice_segment_id INT NOT NULL,
  question_id INT NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (practice_segment_id) REFERENCES practice_segments(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_practice_mcq_question (practice_segment_id, question_id),
  INDEX idx_practice_segment_id (practice_segment_id),
  INDEX idx_question_id (question_id)
);

