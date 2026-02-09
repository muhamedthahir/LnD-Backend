-- Set user mdfaridh142002@gmail.com (Faridh) to primary_admin and remove skillvantix_admin from role ENUM.
-- Run this after reverting the skillvantix_admin role (e.g. if that role was previously added).

-- 1. Update Faridh to primary_admin (safe if they are already primary_admin or skillvantix_admin)
UPDATE users SET role = 'primary_admin' WHERE email = 'mdfaridh142002@gmail.com';

-- 2. Remove skillvantix_admin from ENUM (only run if no other users have this role, or after step 1)
ALTER TABLE users
MODIFY COLUMN role ENUM('student', 'college_admin', 'primary_admin') NOT NULL DEFAULT 'student';
