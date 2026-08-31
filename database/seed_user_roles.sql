-- =============================================
-- Seed User Roles SQL Script
-- Run this script directly in your database
-- =============================================

-- 1. Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  role_rank INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_role_rank (role_rank)
);

-- 2. Add role_id column to users table (ignore error if already exists)
ALTER TABLE users 
ADD COLUMN role_id INT NULL AFTER role,
ADD INDEX idx_role_id (role_id);

-- 3. Insert user roles (ignore if already exists)
INSERT IGNORE INTO user_roles (name, description, role_rank) VALUES 
('primary_admin', 'Primary administrator with full system access', 1),
('campuszen_admin', 'CampusZen administrator with the same access as primary admin', 1),
('college_admin', 'College administrator with institution-level access', 2),
('student', 'Student user with course access', 3);

-- 4. Update existing users to link with role_id based on their role
UPDATE users u
JOIN user_roles ur ON u.role = ur.name
SET u.role_id = ur.id
WHERE u.role_id IS NULL;

-- 5. Verify: Display all roles
SELECT * FROM user_roles ORDER BY role_rank ASC;

-- 6. Verify: Check users with their role_id
SELECT id, name, email, role, role_id FROM users LIMIT 10;

