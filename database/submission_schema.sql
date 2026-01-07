-- Submission Schema for LnD Platform
-- This schema handles all types of user submissions and progress tracking

-- =====================================================
-- 1. BASE SUBMISSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  submission_type ENUM('programming', 'lesson', 'mcq') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id),
  INDEX idx_submission_type (submission_type),
  INDEX idx_user_course (user_id, course_id)
);

-- =====================================================
-- 2. PROGRAMMING SUBMISSIONS (Main - One per user per question)
-- =====================================================
CREATE TABLE IF NOT EXISTS programming_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  user_id INT NOT NULL,
  programming_question_id INT NOT NULL,
  practice_segment_id INT NOT NULL,
  status ENUM('pending', 'running', 'completed', 'error') DEFAULT 'pending',
  best_submitted_code TEXT,
  last_submitted_code TEXT,
  language_used VARCHAR(50),
  submission_count INT DEFAULT 1,
  successful_submission BOOLEAN DEFAULT FALSE,
  best_test_cases_passed INT DEFAULT 0,
  last_test_cases_passed INT DEFAULT 0,
  test_cases_total INT DEFAULT 0,
  best_score DECIMAL(5,2) DEFAULT 0,
  last_score DECIMAL(5,2) DEFAULT 0,
  max_score DECIMAL(5,2) DEFAULT 100,
  first_submitted_at TIMESTAMP NULL,
  last_submitted_at TIMESTAMP NULL,
  best_submitted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (programming_question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (practice_segment_id) REFERENCES practice_segments(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_programming_question (user_id, programming_question_id),
  INDEX idx_submission_id (submission_id),
  INDEX idx_user_id (user_id),
  INDEX idx_question_id (programming_question_id),
  INDEX idx_practice_segment_id (practice_segment_id),
  INDEX idx_status (status)
);

-- =====================================================
-- 3. PROGRAMMING SUBMISSION HISTORY (All attempts)
-- =====================================================
CREATE TABLE IF NOT EXISTS programming_submission_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  programming_submission_id INT NOT NULL,
  attempt_number INT NOT NULL,
  submitted_code TEXT NOT NULL,
  language_used VARCHAR(50) NOT NULL,
  status ENUM('pending', 'running', 'completed', 'error') NOT NULL,
  test_cases_passed INT DEFAULT 0,
  test_cases_total INT DEFAULT 0,
  score DECIMAL(5,2) DEFAULT 0,
  execution_time_ms INT,
  output TEXT,
  error_message TEXT,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (programming_submission_id) REFERENCES programming_submissions(id) ON DELETE CASCADE,
  INDEX idx_programming_submission_id (programming_submission_id),
  INDEX idx_attempt_number (attempt_number)
);

-- =====================================================
-- 4. LESSON SUBMISSIONS (Main - One per user per segment)
-- =====================================================
CREATE TABLE IF NOT EXISTS lesson_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  user_id INT NOT NULL,
  segment_id INT NOT NULL,
  topic_id INT NOT NULL,
  course_id INT NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  progress_percentage INT DEFAULT 0,
  total_time_spent_seconds INT DEFAULT 0,
  access_count INT DEFAULT 0,
  first_accessed_at TIMESTAMP NULL,
  last_accessed_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_lesson_segment (user_id, segment_id),
  INDEX idx_submission_id (submission_id),
  INDEX idx_user_id (user_id),
  INDEX idx_segment_id (segment_id),
  INDEX idx_topic_id (topic_id),
  INDEX idx_course_id (course_id),
  INDEX idx_status (status)
);

-- =====================================================
-- 5. LESSON ACCESS HISTORY (Track each session)
-- =====================================================
CREATE TABLE IF NOT EXISTS lesson_access_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  lesson_submission_id INT NOT NULL,
  session_number INT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP NULL,
  duration_seconds INT DEFAULT 0,
  progress_before INT DEFAULT 0,
  progress_after INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lesson_submission_id) REFERENCES lesson_submissions(id) ON DELETE CASCADE,
  INDEX idx_lesson_submission_id (lesson_submission_id),
  INDEX idx_session_number (session_number)
);

-- =====================================================
-- 6. MCQ SUBMISSIONS (Main - One per user per question)
-- =====================================================
CREATE TABLE IF NOT EXISTS mcq_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  submission_id INT NOT NULL,
  user_id INT NOT NULL,
  mcq_question_id INT NOT NULL,
  practice_segment_id INT NOT NULL,
  status ENUM('unanswered', 'answered', 'skipped') DEFAULT 'unanswered',
  last_selected_options JSON,
  best_selected_options JSON,
  correct_options JSON,
  is_correct BOOLEAN DEFAULT FALSE,
  best_score DECIMAL(5,2) DEFAULT 0,
  last_score DECIMAL(5,2) DEFAULT 0,
  max_score DECIMAL(5,2) DEFAULT 100,
  attempt_count INT DEFAULT 0,
  total_time_spent_seconds INT DEFAULT 0,
  first_answered_at TIMESTAMP NULL,
  last_answered_at TIMESTAMP NULL,
  feedback_shown BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mcq_question_id) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (practice_segment_id) REFERENCES practice_segments(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_mcq_question (user_id, mcq_question_id),
  INDEX idx_submission_id (submission_id),
  INDEX idx_user_id (user_id),
  INDEX idx_question_id (mcq_question_id),
  INDEX idx_practice_segment_id (practice_segment_id),
  INDEX idx_status (status)
);

-- =====================================================
-- 7. MCQ SUBMISSION HISTORY (All attempts)
-- =====================================================
CREATE TABLE IF NOT EXISTS mcq_submission_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mcq_submission_id INT NOT NULL,
  attempt_number INT NOT NULL,
  selected_options JSON NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  score DECIMAL(5,2) DEFAULT 0,
  time_spent_seconds INT DEFAULT 0,
  answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mcq_submission_id) REFERENCES mcq_submissions(id) ON DELETE CASCADE,
  INDEX idx_mcq_submission_id (mcq_submission_id),
  INDEX idx_attempt_number (attempt_number)
);

-- =====================================================
-- 8. USER SEGMENT PROGRESS (Aggregated progress summary)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_segment_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  topic_id INT NOT NULL,
  segment_id INT NULL,
  practice_segment_id INT NULL,
  segment_type ENUM('lesson', 'practice', 'assessment') NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  progress_percentage INT DEFAULT 0,
  score DECIMAL(5,2) DEFAULT 0,
  max_score DECIMAL(5,2) DEFAULT 0,
  items_completed INT DEFAULT 0,
  items_total INT DEFAULT 0,
  time_spent_seconds INT DEFAULT 0,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
  FOREIGN KEY (practice_segment_id) REFERENCES practice_segments(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_segment (user_id, segment_id),
  UNIQUE KEY unique_user_practice_segment (user_id, practice_segment_id),
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id),
  INDEX idx_topic_id (topic_id),
  INDEX idx_segment_id (segment_id),
  INDEX idx_practice_segment_id (practice_segment_id),
  INDEX idx_status (status),
  INDEX idx_user_course (user_id, course_id),
  INDEX idx_user_topic (user_id, topic_id)
);

-- =====================================================
-- 9. USER TOPIC PROGRESS (Topic-level summary)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_topic_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  topic_id INT NOT NULL,
  status ENUM('not_started', 'in_progress', 'completed') DEFAULT 'not_started',
  progress_percentage INT DEFAULT 0,
  segments_completed INT DEFAULT 0,
  segments_total INT DEFAULT 0,
  score DECIMAL(5,2) DEFAULT 0,
  max_score DECIMAL(5,2) DEFAULT 0,
  time_spent_seconds INT DEFAULT 0,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_topic (user_id, topic_id),
  INDEX idx_user_id (user_id),
  INDEX idx_course_id (course_id),
  INDEX idx_topic_id (topic_id),
  INDEX idx_status (status),
  INDEX idx_user_course (user_id, course_id)
);

-- =====================================================
-- Update existing user_courses table to sync with progress
-- =====================================================
-- Note: The existing user_courses table already has:
-- - progress_percentage
-- - status
-- We'll update this table via triggers or application logic
-- when user_topic_progress changes


