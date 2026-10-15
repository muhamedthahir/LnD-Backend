-- Migration: Create mail_status table
-- Description: Track email sending status and history

CREATE TABLE IF NOT EXISTS mail_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Template reference (nullable for non-template emails)
  mailer_template_id INT NULL,
  
  -- Email status
  status ENUM('pending', 'success', 'failure', 'skipped', 'bounced', 'complained') NOT NULL DEFAULT 'pending',
  
  -- Status message/description
  message TEXT,
  
  -- Email addresses
  to_address VARCHAR(500) NOT NULL,
  from_address VARCHAR(255),
  cc_address VARCHAR(500),
  bcc_address VARCHAR(500),
  reply_to VARCHAR(255),
  
  -- Email content reference
  subject VARCHAR(500),
  
  -- SES response data
  message_id VARCHAR(255),
  
  -- Error tracking
  error_code VARCHAR(100),
  error_details TEXT,
  
  -- Retry tracking
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMP NULL,
  
  -- Timestamps
  queued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  opened_at TIMESTAMP NULL,
  clicked_at TIMESTAMP NULL,
  
  -- User tracking
  sent_by INT NULL,
  recipient_user_id INT NULL,
  
  -- Additional metadata
  metadata JSON,
  
  -- Foreign keys
  FOREIGN KEY (mailer_template_id) REFERENCES mailer_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (sent_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
  
  -- Indexes for efficient queries
  INDEX idx_status (status),
  INDEX idx_to_address (to_address(100)),
  INDEX idx_queued_at (queued_at),
  INDEX idx_sent_at (sent_at),
  INDEX idx_template_id (mailer_template_id),
  INDEX idx_message_id (message_id)
);

-- Example query to get email statistics
-- SELECT 
--   status, 
--   COUNT(*) as count,
--   DATE(queued_at) as date
-- FROM mail_status
-- GROUP BY status, DATE(queued_at)
-- ORDER BY date DESC;

