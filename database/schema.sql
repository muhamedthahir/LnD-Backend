-- Database Schema for EdTech Backend
-- Run this SQL script to create all necessary tables

-- Institutions table (colleges)
CREATE TABLE IF NOT EXISTS institutions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
);

-- Users table with roles
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NULL,
  role ENUM('student', 'college_admin', 'primary_admin') NOT NULL DEFAULT 'student',
  college_name VARCHAR(255) NULL,
  roll_number VARCHAR(50) NULL,
  department VARCHAR(255) NULL,
  section VARCHAR(50) DEFAULT '1',
  degree VARCHAR(255) NULL,
  otp VARCHAR(10) NULL,
  otp_expires_at TIMESTAMP NULL,
  password_set BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_college_name (college_name),
  INDEX idx_roll_number (roll_number),
  INDEX idx_department (department),
  INDEX idx_otp (otp)
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_created_by (created_by)
);

-- Topics table
CREATE TABLE IF NOT EXISTS topics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  INDEX idx_course_id (course_id),
  INDEX idx_order (order_index)
);

-- Segments table with segment types
CREATE TABLE IF NOT EXISTS segments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  topic_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  segment_type ENUM('coding', 'mcq', 'reference_videos', 'articles', 'assessment') NOT NULL,
  order_index INT DEFAULT 0,
  content JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  INDEX idx_topic_id (topic_id),
  INDEX idx_segment_type (segment_type),
  INDEX idx_order (order_index)
);

-- Concepts table
CREATE TABLE IF NOT EXISTS concepts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  segment_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
  INDEX idx_segment_id (segment_id),
  INDEX idx_order (order_index)
);

-- InClass Practice table
CREATE TABLE IF NOT EXISTS inclass_practice (
  id INT AUTO_INCREMENT PRIMARY KEY,
  segment_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
  INDEX idx_segment_id (segment_id),
  INDEX idx_order (order_index)
);

-- PostClass Practice table
CREATE TABLE IF NOT EXISTS postclass_practice (
  id INT AUTO_INCREMENT PRIMARY KEY,
  segment_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
  INDEX idx_segment_id (segment_id),
  INDEX idx_order (order_index)
);

-- Enrollments table (Many-to-Many: Students and Courses)
CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  status ENUM('invited', 'inProgress', 'completed', 'Expired') NOT NULL DEFAULT 'invited',
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE KEY unique_enrollment (student_id, course_id),
  INDEX idx_student_id (student_id),
  INDEX idx_course_id (course_id),
  INDEX idx_status (status)
);

-- Groups table
CREATE TABLE IF NOT EXISTS `groups` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  college_name VARCHAR(255) NOT NULL,
  degree VARCHAR(255) NULL,
  department VARCHAR(255) NULL,
  passout_year INT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_college_name (college_name),
  INDEX idx_department (department),
  INDEX idx_created_by (created_by)
);

-- Group Members table (Many-to-Many: Groups and Users)
CREATE TABLE IF NOT EXISTS group_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  user_id INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_group_member (group_id, user_id),
  INDEX idx_group_id (group_id),
  INDEX idx_user_id (user_id)
);

