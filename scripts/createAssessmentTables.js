/**
 * Script to create all assessment-related tables
 * Run: node scripts/createAssessmentTables.js
 */

const pool = require('../config/db');
const Assessment = require('../models/Assessment');
const AssessmentSegment = require('../models/AssessmentSegment');
const AssessmentAdministrator = require('../models/AssessmentAdministrator');
const AssessmentUserMapping = require('../models/AssessmentUserMapping');
const {
  TimingConfig,
  ProctoringConfig,
  ScoringConfig,
  QuestionConfig,
  AccessConfig,
  RandomFetchCriteria,
  SegmentProgrammingQuestion,
  SegmentMCQQuestion,
  AssessmentSegmentProgress,
  UserQuestionAssignment,
  ProctoringLog
} = require('../models/AssessmentConfigs');

async function createTables() {
  try {
    console.log('Creating assessment tables...\n');

    // Create tables in order (respecting foreign key dependencies)
    console.log('1. Creating assessments table...');
    await Assessment.createTable();

    console.log('2. Creating assessment_segments table...');
    await AssessmentSegment.createTable();

    console.log('3. Creating segment_programming_questions table...');
    await SegmentProgrammingQuestion.createTable();

    console.log('4. Creating segment_mcq_questions table...');
    await SegmentMCQQuestion.createTable();

    console.log('5. Creating random_fetch_criteria table...');
    await RandomFetchCriteria.createTable();

    console.log('6. Creating assessment_administrators table...');
    await AssessmentAdministrator.createTable();

    console.log('7. Creating timing_configs table...');
    await TimingConfig.createTable();

    console.log('8. Creating proctoring_configs table...');
    await ProctoringConfig.createTable();

    console.log('9. Creating scoring_configs table...');
    await ScoringConfig.createTable();

    console.log('10. Creating question_configs table...');
    await QuestionConfig.createTable();

    console.log('11. Creating access_configs table...');
    await AccessConfig.createTable();

    console.log('12. Creating assessment_user_mappings table...');
    await AssessmentUserMapping.createTable();

    console.log('13. Creating user_question_assignments table...');
    await UserQuestionAssignment.createTable();

    console.log('14. Creating assessment_segment_progress table...');
    await AssessmentSegmentProgress.createTable();

    console.log('15. Creating proctoring_logs table...');
    await ProctoringLog.createTable();

    // Create assessment_tags junction table
    console.log('16. Creating assessment_tags table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS assessment_tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        assessment_id INT NOT NULL,
        tag_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_assessment_tag (assessment_id, tag_id),
        INDEX idx_assessment (assessment_id),
        INDEX idx_tag (tag_id),
        FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // Add columns to mailer_templates if they don't exist
    console.log('17. Updating mailer_templates table...');
    try {
      await pool.execute(`
        ALTER TABLE mailer_templates 
        ADD COLUMN cc_address VARCHAR(500) DEFAULT NULL,
        ADD COLUMN bcc_address VARCHAR(500) DEFAULT NULL
      `);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.log('   Note: cc_address/bcc_address columns may already exist');
      }
    }

    // Add columns to programming_submissions if they don't exist
    console.log('18. Updating programming_submissions table...');
    try {
      await pool.execute(`
        ALTER TABLE programming_submissions 
        ADD COLUMN assessment_segment_id INT DEFAULT NULL,
        ADD COLUMN assessment_user_mapping_id INT DEFAULT NULL,
        ADD COLUMN time_taken_seconds INT DEFAULT 0,
        ADD COLUMN attempted_at DATETIME DEFAULT NULL
      `);
    } catch (e) {
      console.log('   Note: Some columns may already exist in programming_submissions');
    }

    // Add columns to mcq_submissions if they don't exist
    console.log('19. Updating mcq_submissions table...');
    try {
      await pool.execute(`
        ALTER TABLE mcq_submissions 
        ADD COLUMN assessment_segment_id INT DEFAULT NULL,
        ADD COLUMN assessment_user_mapping_id INT DEFAULT NULL,
        ADD COLUMN time_taken_seconds INT DEFAULT 0,
        ADD COLUMN attempted_at DATETIME DEFAULT NULL
      `);
    } catch (e) {
      console.log('   Note: Some columns may already exist in mcq_submissions');
    }

    console.log('\n✅ All assessment tables created successfully!');
    console.log('\nTables created:');
    console.log('  - assessments');
    console.log('  - assessment_segments');
    console.log('  - segment_programming_questions');
    console.log('  - segment_mcq_questions');
    console.log('  - random_fetch_criteria');
    console.log('  - assessment_administrators');
    console.log('  - timing_configs');
    console.log('  - proctoring_configs');
    console.log('  - scoring_configs');
    console.log('  - question_configs');
    console.log('  - access_configs');
    console.log('  - assessment_user_mappings');
    console.log('  - user_question_assignments');
    console.log('  - assessment_segment_progress');
    console.log('  - proctoring_logs');
    console.log('  - assessment_tags');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    process.exit(1);
  }
}

createTables();

