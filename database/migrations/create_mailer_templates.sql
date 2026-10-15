-- Create mailer_templates table for storing email templates
CREATE TABLE IF NOT EXISTS mailer_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unique_id VARCHAR(50) UNIQUE NOT NULL,                -- Unique identifier (e.g., 'COURSE_INVITE', 'PROMO_SUMMER_2024')
  name VARCHAR(255) NOT NULL,                           -- Display name
  description TEXT,                                     -- What this template is for
  type ENUM('promotional', 'transactional', 'notification', 'reminder') NOT NULL,
  category VARCHAR(100),                                -- Sub-category (e.g., 'course_invite', 'welcome', 'password_reset')
  
  -- Email Content
  subject VARCHAR(500) NOT NULL,                        -- Email subject line (can have variables)
  preview_text VARCHAR(255),                            -- Preview text shown in inbox
  html_template LONGTEXT,                               -- HTML version of template
  text_template TEXT,                                   -- Plain text fallback
  template_format ENUM('html', 'text', 'both') DEFAULT 'html',
  
  -- Dynamic Variables
  has_dynamic_variables BOOLEAN DEFAULT FALSE,
  variables JSON,                                       -- List of expected variables: ["userName", "courseTitle", "link"]
  
  -- Sender Info (defaults, can be overridden)
  default_sender_name VARCHAR(255),
  default_sender_email VARCHAR(255),
  default_reply_to VARCHAR(255),
  
  -- Status & Tracking
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,                               -- For ordering templates
  tags JSON,                                            -- For filtering: ["welcome", "onboarding"]
  version INT DEFAULT 1,                                -- Version tracking
  usage_count INT DEFAULT 0,                            -- How many times used
  last_used_at TIMESTAMP NULL,
  
  -- Audit
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_type (type),
  INDEX idx_category (category),
  INDEX idx_active (is_active),
  INDEX idx_unique_id (unique_id)
);

