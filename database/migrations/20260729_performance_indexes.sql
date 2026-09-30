-- Composite indexes for common assessment and user list query patterns

CREATE INDEX idx_aum_admin_status_created
  ON assessment_user_mappings (assessment_administrator_id, status, created_at);

CREATE INDEX idx_aum_admin_user_attempt
  ON assessment_user_mappings (assessment_administrator_id, user_id, attempt_number);

CREATE INDEX idx_uqa_mapping_segment
  ON user_question_assignments (assessment_user_mapping_id, assessment_segment_id);

CREATE INDEX idx_rfc_segment_active
  ON random_fetch_criteria (assessment_segment_id, is_active);

CREATE INDEX idx_users_college_created
  ON users (college_name, created_at);

CREATE INDEX idx_users_role_college
  ON users (role, college_name);
