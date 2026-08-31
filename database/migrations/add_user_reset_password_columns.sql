-- Migration: Add reset password columns to users
ALTER TABLE users
  ADD COLUMN reset_token VARCHAR(255) NULL,
  ADD COLUMN reset_token_expires_at TIMESTAMP NULL;

CREATE INDEX idx_reset_token ON users (reset_token);

