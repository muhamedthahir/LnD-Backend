-- Catalog tables for department and degree (user creation dropdowns + bulk upload normalization)

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_department_name (name),
  INDEX idx_department_name (name)
);

CREATE TABLE IF NOT EXISTS degrees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_degree_name (name),
  INDEX idx_degree_name (name)
);

INSERT IGNORE INTO departments (name) VALUES
  ('Computer Science'),
  ('Electronics and Communication'),
  ('Mechanical Engineering'),
  ('Civil Engineering'),
  ('Electrical Engineering'),
  ('Information Technology'),
  ('Other');

INSERT IGNORE INTO degrees (name) VALUES
  ('B.Tech'),
  ('M.Tech'),
  ('B.Sc'),
  ('M.Sc'),
  ('MCA'),
  ('MBA'),
  ('Ph.D'),
  ('Other');
