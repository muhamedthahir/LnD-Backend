const pool = require('../config/db');
const Submission = require('./Submission');

class MCQSubmission {
  /**
   * Ensure assessment columns exist in mcq_submissions table
   */
  static async ensureAssessmentColumns() {
    const columnsToAdd = [
      { name: 'assessment_user_mapping_id', definition: 'INT DEFAULT NULL' },
      { name: 'assessment_segment_id', definition: 'INT DEFAULT NULL' }
    ];

    // Ensure status enum includes 'attempted'
    try {
      await pool.execute(`ALTER TABLE mcq_submissions MODIFY COLUMN status ENUM('unanswered', 'answered', 'skipped', 'attempted') DEFAULT 'unanswered'`);
      console.log("Updated status enum in mcq_submissions");
    } catch (e) {
      console.error("Error updating status enum in mcq_submissions:", e.message);
    }

    for (const col of columnsToAdd) {
      try {
        await pool.execute(`ALTER TABLE mcq_submissions ADD COLUMN ${col.name} ${col.definition}`);
        console.log(`Added column ${col.name} to mcq_submissions`);
      } catch (e) {
        // Column already exists - ignore
      }
    }

    // Make submission_id nullable for assessment-based submissions
    try {
      await pool.execute(`ALTER TABLE mcq_submissions MODIFY COLUMN submission_id INT DEFAULT NULL`);
    } catch (e) { /* May fail if constraint exists */ }

    // Drop foreign key constraint if it exists (for assessment submissions that don't need it)
    try {
      await pool.execute(`ALTER TABLE mcq_submissions DROP FOREIGN KEY mcq_submissions_ibfk_1`);
    } catch (e) { /* Constraint may not exist or already dropped */ }

    // Add indexes if they don't exist
    try {
      await pool.execute(`ALTER TABLE mcq_submissions ADD INDEX idx_assessment_mapping (assessment_user_mapping_id)`);
    } catch (e) { /* Index may already exist */ }
    try {
      await pool.execute(`ALTER TABLE mcq_submissions ADD INDEX idx_assessment_segment (assessment_segment_id)`);
    } catch (e) { /* Index may already exist */ }
  }

  /**
   * Create or update MCQ submission for assessment
   * @param {Object} data - submission data for assessment
   */
  static async createOrUpdateForAssessment(data) {
    const {
      user_id,
      assessment_user_mapping_id,
      assessment_segment_id,
      mcq_question_id,
      selected_options,
      correct_options,
      is_correct = false,
      score = 0,
      max_score = 100,
      time_spent_seconds = 0
    } = data;

    // Ensure assessment columns exist
    await this.ensureAssessmentColumns();

    // Check if submission exists for this assessment
    const existing = await this.findByAssessmentAndQuestion(assessment_user_mapping_id, mcq_question_id);

    if (existing) {
      // Determine if this is the best submission
      const isBestScore = score > existing.best_score;

      // Update existing submission
      await pool.execute(
        `UPDATE mcq_submissions SET
           assessment_segment_id = ?,
           last_selected_options = ?,
           best_selected_options = CASE WHEN ? THEN ? ELSE best_selected_options END,
           correct_options = ?,
           is_correct = CASE WHEN ? THEN TRUE ELSE is_correct END,
           best_score = CASE WHEN ? THEN ? ELSE best_score END,
           last_score = ?,
           status = 'answered',
           attempt_count = attempt_count + 1,
           total_time_spent_seconds = total_time_spent_seconds + ?,
           last_answered_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          assessment_segment_id,
          JSON.stringify(selected_options),
          isBestScore, JSON.stringify(selected_options),
          JSON.stringify(correct_options),
          is_correct,
          isBestScore, score,
          score,
          time_spent_seconds,
          existing.id
        ]
      );

      return { id: existing.id, updated: true, score, is_correct };
    } else {
      // Create new submission for assessment (no base submission needed)
      const [result] = await pool.execute(
        `INSERT INTO mcq_submissions 
         (user_id, mcq_question_id, assessment_user_mapping_id, assessment_segment_id,
          status, last_selected_options, best_selected_options, correct_options,
          is_correct, best_score, last_score, max_score, attempt_count,
          total_time_spent_seconds, first_answered_at, last_answered_at)
         VALUES (?, ?, ?, ?, 'answered', ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          user_id, mcq_question_id, assessment_user_mapping_id, assessment_segment_id,
          JSON.stringify(selected_options), JSON.stringify(selected_options), JSON.stringify(correct_options),
          is_correct, score, score, max_score,
          time_spent_seconds
        ]
      );

      return { id: result.insertId, updated: false, score, is_correct };
    }
  }

  /**
   * Find submission by assessment mapping and question
   */
  static async findByAssessmentAndQuestion(assessment_user_mapping_id, mcq_question_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM mcq_submissions WHERE assessment_user_mapping_id = ? AND mcq_question_id = ?',
      [assessment_user_mapping_id, mcq_question_id]
    );
    return rows[0] || null;
  }

  /**
   * Mark a question as attempted (assessment)
   */
  static async markAttemptedForAssessment(data) {
    const { user_id, assessment_user_mapping_id, assessment_segment_id, mcq_question_id } = data;
    
    // Ensure assessment columns exist
    await this.ensureAssessmentColumns();

    const existing = await this.findByAssessmentAndQuestion(assessment_user_mapping_id, mcq_question_id);
    if (existing) return existing.id;

    const [result] = await pool.execute(
      `INSERT INTO mcq_submissions 
       (user_id, mcq_question_id, assessment_user_mapping_id, assessment_segment_id, status, attempt_count)
       VALUES (?, ?, ?, ?, 'attempted', 0)`,
      [user_id, mcq_question_id, assessment_user_mapping_id, assessment_segment_id]
    );
    return result.insertId;
  }

  /**
   * Mark a question as attempted (practice segment)
   */
  static async markAttempted(data) {
    const { user_id, course_id, practice_segment_id, mcq_question_id } = data;

    // Ensure status enum includes 'attempted'
    await this.ensureAssessmentColumns();

    const existing = await this.findByUserAndQuestion(user_id, mcq_question_id);
    if (existing) return existing.id;

    // Create base submission first
    const submissionId = await Submission.create({
      user_id,
      course_id,
      submission_type: 'mcq'
    });

    const [result] = await pool.execute(
      `INSERT INTO mcq_submissions 
       (submission_id, user_id, mcq_question_id, practice_segment_id, status, attempt_count)
       VALUES (?, ?, ?, ?, 'attempted', 0)`,
      [submissionId, user_id, mcq_question_id, practice_segment_id]
    );
    return result.insertId;
  }

  /**
   * Get all MCQ submissions for an assessment mapping
   */
  static async findByAssessmentMapping(assessment_user_mapping_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM mcq_submissions WHERE assessment_user_mapping_id = ?',
      [assessment_user_mapping_id]
    );
    return rows;
  }

  /**
   * Get MCQ submissions for an assessment segment
   */
  static async findByAssessmentSegment(assessment_user_mapping_id, assessment_segment_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM mcq_submissions WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?',
      [assessment_user_mapping_id, assessment_segment_id]
    );
    return rows;
  }

  /**
   * Get total score for an assessment segment (MCQ only)
   */
  static async getSegmentScore(assessment_user_mapping_id, assessment_segment_id) {
    const [result] = await pool.execute(
      `SELECT COALESCE(SUM(last_score), 0) as total_score
       FROM mcq_submissions 
       WHERE assessment_user_mapping_id = ? AND assessment_segment_id = ?`,
      [assessment_user_mapping_id, assessment_segment_id]
    );
    return parseFloat(result[0]?.total_score || 0);
  }

  /**
   * Create or update MCQ submission
   * @param {Object} data - submission data
   */
  static async createOrUpdate(data) {
    const {
      user_id,
      course_id,
      mcq_question_id,
      practice_segment_id,
      selected_options,
      correct_options,
      is_correct = false,
      score = 0,
      max_score = 100,
      time_spent_seconds = 0
    } = data;
    
    // Check if submission exists
    const existing = await this.findByUserAndQuestion(user_id, mcq_question_id);
    
    if (existing) {
      // Determine if this is the best submission
      const isBestScore = score > existing.best_score;
      
      // Update main submission
      await pool.execute(
        `UPDATE mcq_submissions SET
           last_selected_options = ?,
           best_selected_options = CASE WHEN ? THEN ? ELSE best_selected_options END,
           correct_options = ?,
           is_correct = CASE WHEN ? THEN TRUE ELSE is_correct END,
           best_score = CASE WHEN ? THEN ? ELSE best_score END,
           last_score = ?,
           status = 'answered',
           attempt_count = attempt_count + 1,
           total_time_spent_seconds = total_time_spent_seconds + ?,
           last_answered_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          JSON.stringify(selected_options),
          isBestScore, JSON.stringify(selected_options),
          JSON.stringify(correct_options),
          is_correct,
          isBestScore, score,
          score,
          time_spent_seconds,
          existing.id
        ]
      );
      
      // Create history entry
      await this.createHistory({
        mcq_submission_id: existing.id,
        attempt_number: existing.attempt_count + 1,
        selected_options,
        is_correct,
        score,
        time_spent_seconds
      });
      
      return existing.id;
    } else {
      // Create base submission first
      const submissionId = await Submission.create({
        user_id,
        course_id,
        submission_type: 'mcq'
      });
      
      // Create MCQ submission
      const [result] = await pool.execute(
        `INSERT INTO mcq_submissions 
         (submission_id, user_id, mcq_question_id, practice_segment_id,
          status, last_selected_options, best_selected_options, correct_options,
          is_correct, best_score, last_score, max_score, attempt_count,
          total_time_spent_seconds, first_answered_at, last_answered_at)
         VALUES (?, ?, ?, ?, 'answered', ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          submissionId, user_id, mcq_question_id, practice_segment_id,
          JSON.stringify(selected_options), JSON.stringify(selected_options), JSON.stringify(correct_options),
          is_correct, score, score, max_score,
          time_spent_seconds
        ]
      );
      
      // Create first history entry
      await this.createHistory({
        mcq_submission_id: result.insertId,
        attempt_number: 1,
        selected_options,
        is_correct,
        score,
        time_spent_seconds
      });
      
      return result.insertId;
    }
  }

  /**
   * Create history entry
   */
  static async createHistory(data) {
    const {
      mcq_submission_id,
      attempt_number,
      selected_options,
      is_correct,
      score,
      time_spent_seconds
    } = data;
    
    await pool.execute(
      `INSERT INTO mcq_submission_history 
       (mcq_submission_id, attempt_number, selected_options, is_correct, score, time_spent_seconds)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [mcq_submission_id, attempt_number, JSON.stringify(selected_options), is_correct, score, time_spent_seconds]
    );
  }

  /**
   * Mark question as skipped
   */
  static async markSkipped(user_id, mcq_question_id, course_id, practice_segment_id) {
    const existing = await this.findByUserAndQuestion(user_id, mcq_question_id);
    
    if (existing) {
      await pool.execute(
        `UPDATE mcq_submissions SET status = 'skipped', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [existing.id]
      );
      return existing.id;
    } else {
      // Create base submission
      const submissionId = await Submission.create({
        user_id,
        course_id,
        submission_type: 'mcq'
      });
      
      const [result] = await pool.execute(
        `INSERT INTO mcq_submissions 
         (submission_id, user_id, mcq_question_id, practice_segment_id, status)
         VALUES (?, ?, ?, ?, 'skipped')`,
        [submissionId, user_id, mcq_question_id, practice_segment_id]
      );
      return result.insertId;
    }
  }

  /**
   * Show feedback for a question
   */
  static async showFeedback(user_id, mcq_question_id) {
    await pool.execute(
      `UPDATE mcq_submissions SET feedback_shown = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = ? AND mcq_question_id = ?`,
      [user_id, mcq_question_id]
    );
  }

  /**
   * Find by user and question
   */
  static async findByUserAndQuestion(user_id, mcq_question_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM mcq_submissions WHERE user_id = ? AND mcq_question_id = ?',
      [user_id, mcq_question_id]
    );
    return rows[0] || null;
  }

  /**
   * Find by ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM mcq_submissions WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find all submissions for a practice segment by user
   */
  static async findByUserAndPracticeSegment(user_id, practice_segment_id) {
    const [rows] = await pool.execute(
      `SELECT ms.*, q.title as question_title
       FROM mcq_submissions ms
       JOIN questions q ON ms.mcq_question_id = q.id
       WHERE ms.user_id = ? AND ms.practice_segment_id = ?`,
      [user_id, practice_segment_id]
    );
    return rows;
  }

  /**
   * Get submission history
   */
  static async getHistory(mcq_submission_id) {
    const [rows] = await pool.execute(
      `SELECT * FROM mcq_submission_history 
       WHERE mcq_submission_id = ?
       ORDER BY attempt_number ASC`,
      [mcq_submission_id]
    );
    return rows;
  }

  /**
   * Get progress summary for a practice segment
   */
  static async getPracticeSegmentProgress(user_id, practice_segment_id) {
    const [rows] = await pool.execute(
      `SELECT 
         COUNT(*) as total_attempted,
         SUM(CASE WHEN is_correct = TRUE THEN 1 ELSE 0 END) as correct,
         SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
         AVG(best_score) as avg_best_score,
         SUM(attempt_count) as total_attempts
       FROM mcq_submissions
       WHERE user_id = ? AND practice_segment_id = ?`,
      [user_id, practice_segment_id]
    );
    return rows[0];
  }

  /**
   * Get all MCQ submissions for a user in a course
   */
  static async findByUserAndCourse(user_id, course_id) {
    const [rows] = await pool.execute(
      `SELECT ms.*, q.title as question_title, psg.name as practice_segment_name
       FROM mcq_submissions ms
       JOIN submissions s ON ms.submission_id = s.id
       JOIN questions q ON ms.mcq_question_id = q.id
       JOIN practice_segments psg ON ms.practice_segment_id = psg.id
       WHERE ms.user_id = ? AND s.course_id = ?`,
      [user_id, course_id]
    );
    return rows;
  }
}

module.exports = MCQSubmission;

