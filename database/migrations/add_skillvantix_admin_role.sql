-- Add skillvantix_admin to users.role ENUM
-- Run this migration before seeding the skillvantix admin user.

ALTER TABLE users
MODIFY COLUMN role ENUM('student', 'college_admin', 'primary_admin', 'skillvantix_admin') NOT NULL DEFAULT 'student';
