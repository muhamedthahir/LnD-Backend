-- Migration: Create institutions table
-- This table stores colleges/institutions that can be used throughout the system

CREATE TABLE IF NOT EXISTS institutions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

-- Insert existing colleges from users table into institutions
INSERT IGNORE INTO institutions (name)
SELECT DISTINCT college_name 
FROM users 
WHERE college_name IS NOT NULL AND college_name != '';

