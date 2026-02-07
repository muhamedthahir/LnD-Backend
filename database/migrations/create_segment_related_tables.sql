-- Migration: Create segment-related tables if missing
-- Run this if you see "Table 'demo.concepts' doesn't exist" (or inclass_practice, postclass_practice)
-- Usage: mysql -u your_user -p demo < database/migrations/create_segment_related_tables.sql

-- Concepts table (sub-content for lesson segments)
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
