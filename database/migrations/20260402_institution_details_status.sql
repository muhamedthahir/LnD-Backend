-- Optional institution contact fields and active/inactive status
-- Run against existing databases after pulling this change.

ALTER TABLE institutions
  ADD COLUMN address TEXT NULL AFTER name,
  ADD COLUMN spoc_contact_number VARCHAR(50) NULL AFTER address,
  ADD COLUMN alternate_contact VARCHAR(50) NULL AFTER spoc_contact_number,
  ADD COLUMN alternate_email VARCHAR(255) NULL AFTER alternate_contact,
  ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER alternate_email;

CREATE INDEX idx_institutions_status ON institutions(status);
