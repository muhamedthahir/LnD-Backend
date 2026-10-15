-- =============================================
-- User Details Table SQL Script
-- Stores additional personal information for users
-- =============================================

-- Create user_details table
CREATE TABLE IF NOT EXISTS user_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  mobile_number VARCHAR(20),
  alternate_mobile VARCHAR(20),
  gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
  date_of_birth DATE,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  linkedin_url VARCHAR(255),
  github_url VARCHAR(255),
  portfolio_url VARCHAR(255),
  bio TEXT,
  profile_picture_url VARCHAR(500),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_city (city),
  INDEX idx_state (state),
  INDEX idx_country (country)
);

-- Verify: Display table structure
DESCRIBE user_details;

