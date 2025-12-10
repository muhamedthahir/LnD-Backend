-- ============================================
-- RUN THIS MIGRATION IN YOUR MYSQL CLIENT
-- ============================================
-- This will add all missing columns to the users table
-- If a column already exists, you'll get an error - just ignore it and continue

USE your_database_name; -- Replace with your actual database name

-- Add student fields (ignore error if column exists)
ALTER TABLE users ADD COLUMN roll_number VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN department VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN section VARCHAR(50) DEFAULT '1';

-- Add OTP fields (ignore error if column exists)
ALTER TABLE users ADD COLUMN otp VARCHAR(10) NULL;
ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN password_set BOOLEAN DEFAULT FALSE;

-- Make password nullable
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;

-- Add indexes (ignore error if index exists)
CREATE INDEX idx_roll_number ON users(roll_number);
CREATE INDEX idx_department ON users(department);
CREATE INDEX idx_otp ON users(otp);

-- Verify the changes
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'users' 
ORDER BY ORDINAL_POSITION;

