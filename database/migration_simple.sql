-- Simple Migration: Add all new columns to users table
-- Run this in your MySQL client
-- If a column already exists, you'll get an error - that's okay, just continue

-- Add student fields
ALTER TABLE users ADD COLUMN roll_number VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN department VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN section VARCHAR(50) DEFAULT '1';

-- Add OTP fields
ALTER TABLE users ADD COLUMN otp VARCHAR(10) NULL;
ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN password_set BOOLEAN DEFAULT FALSE;

-- Make password nullable
ALTER TABLE users MODIFY COLUMN password VARCHAR(255) NULL;

-- Add indexes (ignore errors if they already exist)
CREATE INDEX idx_roll_number ON users(roll_number);
CREATE INDEX idx_department ON users(department);
CREATE INDEX idx_otp ON users(otp);

