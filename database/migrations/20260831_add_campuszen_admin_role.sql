-- Add campuszen_admin as a platform admin role (same access as primary_admin).

ALTER TABLE users
MODIFY COLUMN role ENUM('student', 'college_admin', 'primary_admin', 'campuszen_admin') NOT NULL DEFAULT 'student';

INSERT IGNORE INTO user_roles (name, description, role_rank) VALUES
('campuszen_admin', 'CampusZen administrator with the same access as primary admin', 1);
