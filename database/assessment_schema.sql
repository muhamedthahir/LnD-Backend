-- Assessment Module Schema
-- Version: 2.0
-- Last Updated: January 2026

-- =====================================================
-- 1. ASSESSMENT (Main assessment entity)
-- =====================================================
CREATE TABLE IF NOT EXISTS assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unique_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    institution_id INT,
    topic_id INT,
    status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') DEFAULT 'DRAFT',
    is_published BOOLEAN DEFAULT FALSE,
    total_duration INT DEFAULT 0 COMMENT 'Total duration in seconds (computed)',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_by INT,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_institution (institution_id),
    INDEX idx_topic (topic_id),
    INDEX idx_created_at (created_at),
    INDEX idx_unique_id (unique_id),
    
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- 2. ASSESSMENT_SEGMENT (Sections of an assessment)
-- =====================================================
CREATE TABLE IF NOT EXISTS assessment_segments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unique_id VARCHAR(50) UNIQUE NOT NULL,
    assessment_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sequence_order INT NOT NULL DEFAULT 1,
    segment_duration INT NOT NULL DEFAULT 1800 COMMENT 'Duration in seconds',
    total_marks INT DEFAULT 0 COMMENT 'Sum of question weightages',
    allow_back_navigation BOOLEAN DEFAULT TRUE,
    is_locked BOOLEAN DEFAULT FALSE,
    negative_marking_enabled BOOLEAN DEFAULT NULL COMMENT 'Override at segment level',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_assessment (assessment_id),
    INDEX idx_sequence (assessment_id, sequence_order),
    INDEX idx_unique_id (unique_id),
    
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE
);

-- =====================================================
-- 3. SEGMENT_PROGRAMMING_QUESTION (Junction table)
-- =====================================================
CREATE TABLE IF NOT EXISTS segment_programming_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_segment_id INT NOT NULL,
    programming_question_id INT NOT NULL,
    sequence_order INT NOT NULL DEFAULT 1,
    weightage_override INT DEFAULT NULL COMMENT 'Override question default weightage',
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_segment_question (assessment_segment_id, programming_question_id),
    INDEX idx_segment (assessment_segment_id),
    INDEX idx_question (programming_question_id),
    INDEX idx_sequence (assessment_segment_id, sequence_order),
    
    FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE,
    FOREIGN KEY (programming_question_id) REFERENCES programming_questions(id) ON DELETE CASCADE
);

-- =====================================================
-- 4. SEGMENT_MCQ_QUESTION (Junction table)
-- =====================================================
CREATE TABLE IF NOT EXISTS segment_mcq_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_segment_id INT NOT NULL,
    mcq_question_id INT NOT NULL,
    sequence_order INT NOT NULL DEFAULT 1,
    weightage_override INT DEFAULT NULL COMMENT 'Override question default weightage',
    is_mandatory BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_segment_mcq (assessment_segment_id, mcq_question_id),
    INDEX idx_segment (assessment_segment_id),
    INDEX idx_mcq (mcq_question_id),
    INDEX idx_sequence (assessment_segment_id, sequence_order),
    
    FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE,
    FOREIGN KEY (mcq_question_id) REFERENCES mcq_multiselect_questions(id) ON DELETE CASCADE
);

-- =====================================================
-- 5. RANDOM_FETCH_CRITERIA (Criteria for random question fetch)
-- =====================================================
CREATE TABLE IF NOT EXISTS random_fetch_criteria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_segment_id INT NOT NULL,
    question_type ENUM('PROGRAMMING', 'MCQ') NOT NULL,
    question_bank_id INT DEFAULT NULL,
    total_questions INT NOT NULL DEFAULT 5,
    easy_count INT DEFAULT 0,
    medium_count INT DEFAULT 0,
    hard_count INT DEFAULT 0,
    topics VARCHAR(500) DEFAULT NULL COMMENT 'Comma-separated topic IDs',
    tags VARCHAR(500) DEFAULT NULL COMMENT 'Comma-separated tag IDs',
    exclude_question_ids TEXT DEFAULT NULL COMMENT 'Comma-separated question IDs to exclude',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_segment (assessment_segment_id),
    INDEX idx_question_type (question_type),
    
    FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE,
    FOREIGN KEY (question_bank_id) REFERENCES question_banks(id) ON DELETE SET NULL
);

-- =====================================================
-- 6. ASSESSMENT_ADMINISTRATOR (Configuration entity)
-- =====================================================
CREATE TABLE IF NOT EXISTS assessment_administrators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unique_id VARCHAR(50) UNIQUE NOT NULL,
    assessment_id INT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    config_name VARCHAR(255),
    target_audience TEXT,
    category_id INT,
    job_role VARCHAR(255),
    experience INT DEFAULT NULL,
    instruction_page LONGTEXT COMMENT 'HTML content',
    mailer_template_id INT DEFAULT NULL,
    status ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED') DEFAULT 'DRAFT',
    is_default BOOLEAN DEFAULT FALSE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_assessment (assessment_id),
    INDEX idx_status (status),
    INDEX idx_unique_id (unique_id),
    INDEX idx_category (category_id),
    
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (mailer_template_id) REFERENCES mailer_templates(id) ON DELETE SET NULL
);

-- =====================================================
-- 7. TIMING_CONFIG (Timing settings)
-- =====================================================
CREATE TABLE IF NOT EXISTS timing_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_administrator_id INT NOT NULL,
    total_time INT NOT NULL DEFAULT 0 COMMENT 'Total time in seconds',
    timing_mode ENUM('SEGMENT_WISE', 'OVERALL', 'BOTH') DEFAULT 'SEGMENT_WISE',
    start_date_time DATETIME DEFAULT NULL,
    end_date_time DATETIME DEFAULT NULL,
    allow_early_segment_submit BOOLEAN DEFAULT TRUE,
    carry_forward_time BOOLEAN DEFAULT FALSE,
    auto_submit_on_timeout BOOLEAN DEFAULT TRUE,
    grace_period_seconds INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_admin (assessment_administrator_id),
    
    FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
);

-- =====================================================
-- 8. PROCTORING_CONFIG (Proctoring settings)
-- =====================================================
CREATE TABLE IF NOT EXISTS proctoring_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_administrator_id INT NOT NULL,
    proctoring_enabled BOOLEAN DEFAULT FALSE,
    full_screen_mandatory BOOLEAN DEFAULT FALSE,
    webcam_required BOOLEAN DEFAULT FALSE,
    max_tab_switch_allowed INT DEFAULT -1 COMMENT '-1 means unlimited',
    disable_copy_paste BOOLEAN DEFAULT FALSE,
    disable_right_click BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_admin (assessment_administrator_id),
    
    FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
);

-- =====================================================
-- 9. SCORING_CONFIG (Scoring settings)
-- =====================================================
CREATE TABLE IF NOT EXISTS scoring_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_administrator_id INT NOT NULL,
    threshold_for_pass INT DEFAULT 40,
    threshold_type ENUM('PERCENTAGE', 'ABSOLUTE_SCORE') DEFAULT 'PERCENTAGE',
    negative_marking_enabled BOOLEAN DEFAULT FALSE,
    negative_mark_percentage DECIMAL(5,2) DEFAULT 0.00,
    show_score_at_end BOOLEAN DEFAULT FALSE,
    show_correct_answers_after BOOLEAN DEFAULT FALSE,
    show_feedback_or_rating BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_admin (assessment_administrator_id),
    
    FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
);

-- =====================================================
-- 10. QUESTION_CONFIG (Question handling settings)
-- =====================================================
CREATE TABLE IF NOT EXISTS question_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_administrator_id INT NOT NULL,
    fetch_random_question BOOLEAN DEFAULT FALSE,
    randomize_question_to_users BOOLEAN DEFAULT FALSE,
    shuffle_options_in_mcq BOOLEAN DEFAULT FALSE,
    allow_review_before_submit BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_admin (assessment_administrator_id),
    
    FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
);

-- =====================================================
-- 11. ACCESS_CONFIG (Access control settings)
-- =====================================================
CREATE TABLE IF NOT EXISTS access_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_administrator_id INT NOT NULL,
    access_code VARCHAR(100) DEFAULT NULL,
    max_attempts INT DEFAULT 1,
    allow_resume BOOLEAN DEFAULT TRUE,
    resume_window_minutes INT DEFAULT 30,
    ip_restriction VARCHAR(500) DEFAULT NULL COMMENT 'Comma-separated IP ranges',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_admin (assessment_administrator_id),
    
    FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE
);

-- =====================================================
-- 12. ASSESSMENT_USER_MAPPING (User attempt tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS assessment_user_mappings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unique_id VARCHAR(50) UNIQUE NOT NULL,
    assessment_administrator_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('INVITED', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXPIRED', 'DISQUALIFIED') DEFAULT 'INVITED',
    attempt_number INT DEFAULT 1,
    mail_sent_at DATETIME DEFAULT NULL,
    assessment_started_time DATETIME DEFAULT NULL,
    assessment_ended_time DATETIME DEFAULT NULL,
    submitted_at DATETIME DEFAULT NULL,
    total_time_worked INT DEFAULT 0 COMMENT 'Total seconds worked',
    current_segment_index INT DEFAULT 0,
    current_question_index INT DEFAULT 0,
    time_remaining INT DEFAULT 0,
    segment_time_remaining INT DEFAULT 0,
    last_activity_at DATETIME DEFAULT NULL,
    resume_count INT DEFAULT 0,
    attempt_count INT DEFAULT 1,
    -- Scoring
    total_score DECIMAL(10,2) DEFAULT 0,
    max_possible_score DECIMAL(10,2) DEFAULT 0,
    percentage_score DECIMAL(5,2) DEFAULT 0,
    passed BOOLEAN DEFAULT FALSE,
    segment_wise_scores JSON DEFAULT NULL,
    -- Proctoring & Audit
    ip_address VARCHAR(45) DEFAULT NULL,
    browser_info VARCHAR(500) DEFAULT NULL,
    tab_switch_count INT DEFAULT 0,
    refresh_violation_count INT DEFAULT 1,
    -- Feedback
    feedback_rating INT DEFAULT NULL CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comment TEXT DEFAULT NULL,
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_attempt (user_id, assessment_administrator_id, attempt_number),
    INDEX idx_administrator (assessment_administrator_id),
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_unique_id (unique_id),
    
    FOREIGN KEY (assessment_administrator_id) REFERENCES assessment_administrators(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- 13. USER_QUESTION_ASSIGNMENT (Questions assigned to user)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_question_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_user_mapping_id INT NOT NULL,
    assessment_segment_id INT NOT NULL,
    question_type ENUM('PROGRAMMING', 'MCQ') NOT NULL,
    question_id INT NOT NULL,
    sequence_order INT NOT NULL DEFAULT 1,
    weightage INT NOT NULL DEFAULT 1,
    is_from_random_fetch BOOLEAN DEFAULT FALSE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_assignment (assessment_user_mapping_id, assessment_segment_id, question_type, question_id),
    INDEX idx_user_mapping (assessment_user_mapping_id),
    INDEX idx_segment (assessment_segment_id),
    INDEX idx_sequence (assessment_user_mapping_id, assessment_segment_id, sequence_order),
    
    FOREIGN KEY (assessment_user_mapping_id) REFERENCES assessment_user_mappings(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE
);

-- =====================================================
-- 14. ASSESSMENT_SEGMENT_PROGRESS (User progress per segment)
-- =====================================================
CREATE TABLE IF NOT EXISTS assessment_segment_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_user_mapping_id INT NOT NULL,
    assessment_segment_id INT NOT NULL,
    status ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'NOT_STARTED',
    started_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    time_allocated INT NOT NULL DEFAULT 0 COMMENT 'Seconds allocated',
    time_used INT DEFAULT 0 COMMENT 'Actual seconds used',
    time_remaining INT DEFAULT 0 COMMENT 'Remaining time if carry forward',
    score DECIMAL(10,2) DEFAULT 0,
    total_questions INT DEFAULT 0,
    attempted_questions INT DEFAULT 0,
    current_question_index INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_progress (assessment_user_mapping_id, assessment_segment_id),
    INDEX idx_user_mapping (assessment_user_mapping_id),
    INDEX idx_segment (assessment_segment_id),
    INDEX idx_status (status),
    
    FOREIGN KEY (assessment_user_mapping_id) REFERENCES assessment_user_mappings(id) ON DELETE CASCADE,
    FOREIGN KEY (assessment_segment_id) REFERENCES assessment_segments(id) ON DELETE CASCADE
);

-- =====================================================
-- 15. PROCTORING_LOG (Proctoring events)
-- =====================================================
CREATE TABLE IF NOT EXISTS proctoring_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_user_mapping_id INT NOT NULL,
    event_type ENUM('TAB_SWITCH', 'FULLSCREEN_EXIT', 'WINDOW_BLUR', 'COPY_PASTE', 'RIGHT_CLICK', 'FACE_NOT_DETECTED', 'MULTIPLE_FACES', 'SCREEN_SHARE_STOPPED') NOT NULL,
    event_timestamp DATETIME NOT NULL,
    metadata JSON DEFAULT NULL,
    segment_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_mapping (assessment_user_mapping_id),
    INDEX idx_event_type (event_type),
    INDEX idx_timestamp (event_timestamp),
    
    FOREIGN KEY (assessment_user_mapping_id) REFERENCES assessment_user_mappings(id) ON DELETE CASCADE,
    FOREIGN KEY (segment_id) REFERENCES assessment_segments(id) ON DELETE SET NULL
);

-- =====================================================
-- 16. ASSESSMENT_TAGS (Junction table for assessment tags)
-- =====================================================
CREATE TABLE IF NOT EXISTS assessment_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    assessment_id INT NOT NULL,
    tag_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_assessment_tag (assessment_id, tag_id),
    INDEX idx_assessment (assessment_id),
    INDEX idx_tag (tag_id),
    
    FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- =====================================================
-- UPDATE MAILER_TEMPLATES (Add cc and bcc fields)
-- =====================================================
ALTER TABLE mailer_templates 
ADD COLUMN IF NOT EXISTS cc_address VARCHAR(500) DEFAULT NULL AFTER default_reply_to,
ADD COLUMN IF NOT EXISTS bcc_address VARCHAR(500) DEFAULT NULL AFTER cc_address;

-- =====================================================
-- UPDATE PROGRAMMING_SUBMISSIONS (Add assessment fields)
-- =====================================================
ALTER TABLE programming_submissions 
ADD COLUMN IF NOT EXISTS assessment_segment_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS assessment_user_mapping_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS time_taken_seconds INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS attempted_at DATETIME DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_assessment_segment (assessment_segment_id),
ADD INDEX IF NOT EXISTS idx_assessment_user_mapping (assessment_user_mapping_id);

-- =====================================================
-- UPDATE MCQ_SUBMISSIONS (Add assessment fields)
-- =====================================================
ALTER TABLE mcq_submissions 
ADD COLUMN IF NOT EXISTS assessment_segment_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS assessment_user_mapping_id INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS time_taken_seconds INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS attempted_at DATETIME DEFAULT NULL,
ADD INDEX IF NOT EXISTS idx_assessment_segment (assessment_segment_id),
ADD INDEX IF NOT EXISTS idx_assessment_user_mapping (assessment_user_mapping_id);

