const pool = require('../config/db');
const Submission = require('./Submission');

class ProgrammingSubmission {
  /**
   * Create or update programming submission
   * @param {Object} data - submission data
   */
  static async createOrUpdate(data) {
    const {
      user_id,
      course_id,
      programming_question_id,
      practice_segment_id,
      submitted_code,
      language_used,
      status = 'pending',
      test_cases_passed = 0,
      test_cases_total = 0,
      score = 0,
      max_score = 100,
      execution_time_ms = null,
      output = null,
      error_message = null
    } = data;
    
    // Check if submission exists
    const existing = await this.findByUserAndQuestion(user_id, programming_question_id);
    
    const successful = test_cases_total > 0 && test_cases_passed === test_cases_total;
    
    if (existing) {
      // Determine if this is the best submission
      const isBestScore = score > existing.best_score;
      const isBestTests = test_cases_passed > existing.best_test_cases_passed;
      
      // Update main submission
      await pool.execute(
        `UPDATE programming_submissions SET
           last_submitted_code = ?,
           language_used = ?,
           status = ?,
           submission_count = submission_count + 1,
           successful_submission = CASE WHEN ? THEN TRUE ELSE successful_submission END,
           best_test_cases_passed = CASE WHEN ? THEN ? ELSE best_test_cases_passed END,
           last_test_cases_passed = ?,
           test_cases_total = ?,
           best_score = CASE WHEN ? THEN ? ELSE best_score END,
           last_score = ?,
           best_submitted_code = CASE WHEN ? THEN ? ELSE best_submitted_code END,
           best_submitted_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE best_submitted_at END,
           last_submitted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          submitted_code,
          language_used,
          status,
          successful,
          isBestTests, test_cases_passed,
          test_cases_passed,
          test_cases_total,
          isBestScore, score,
          score,
          isBestScore, submitted_code,
          isBestScore,
          existing.id
        ]
      );
      
      // Create history entry
      await this.createHistory({
        programming_submission_id: existing.id,
        attempt_number: existing.submission_count + 1,
        submitted_code,
        language_used,
        status,
        test_cases_passed,
        test_cases_total,
        score,
        execution_time_ms,
        output,
        error_message
      });
      
      return existing.id;
    } else {
      // Create base submission first
      const submissionId = await Submission.create({
        user_id,
        course_id,
        submission_type: 'programming'
      });
      
      // Create programming submission
      const [result] = await pool.execute(
        `INSERT INTO programming_submissions 
         (submission_id, user_id, programming_question_id, practice_segment_id,
          status, best_submitted_code, last_submitted_code, language_used,
          submission_count, successful_submission, best_test_cases_passed,
          last_test_cases_passed, test_cases_total, best_score, last_score, max_score,
          first_submitted_at, last_submitted_at, best_submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          submissionId, user_id, programming_question_id, practice_segment_id,
          status, submitted_code, submitted_code, language_used,
          successful, test_cases_passed, test_cases_passed, test_cases_total,
          score, score, max_score
        ]
      );
      
      // Create first history entry
      await this.createHistory({
        programming_submission_id: result.insertId,
        attempt_number: 1,
        submitted_code,
        language_used,
        status,
        test_cases_passed,
        test_cases_total,
        score,
        execution_time_ms,
        output,
        error_message
      });
      
      return result.insertId;
    }
  }

  /**
   * Create history entry
   */
  static async createHistory(data) {
    const {
      programming_submission_id,
      attempt_number,
      submitted_code,
      language_used,
      status,
      test_cases_passed,
      test_cases_total,
      score,
      execution_time_ms,
      output,
      error_message
    } = data;
    
    await pool.execute(
      `INSERT INTO programming_submission_history 
       (programming_submission_id, attempt_number, submitted_code, language_used,
        status, test_cases_passed, test_cases_total, score, execution_time_ms, output, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        programming_submission_id, attempt_number, submitted_code, language_used,
        status, test_cases_passed, test_cases_total, score, execution_time_ms, output, error_message
      ]
    );
  }

  /**
   * Update submission status after code execution
   */
  static async updateAfterExecution(id, executionResult) {
    const {
      status,
      test_cases_passed,
      test_cases_total,
      score,
      execution_time_ms,
      output,
      error_message
    } = executionResult;
    
    const successful = test_cases_total > 0 && test_cases_passed === test_cases_total;
    
    await pool.execute(
      `UPDATE programming_submissions SET
         status = ?,
         last_test_cases_passed = ?,
         test_cases_total = ?,
         last_score = ?,
         successful_submission = CASE WHEN ? THEN TRUE ELSE successful_submission END,
         best_test_cases_passed = GREATEST(best_test_cases_passed, ?),
         best_score = GREATEST(best_score, ?),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, test_cases_passed, test_cases_total, score, successful, test_cases_passed, score, id]
    );
    
    // Update latest history entry
    await pool.execute(
      `UPDATE programming_submission_history SET
         status = ?,
         test_cases_passed = ?,
         test_cases_total = ?,
         score = ?,
         execution_time_ms = ?,
         output = ?,
         error_message = ?
       WHERE programming_submission_id = ?
       ORDER BY attempt_number DESC LIMIT 1`,
      [status, test_cases_passed, test_cases_total, score, execution_time_ms, output, error_message, id]
    );
  }

  /**
   * Find by user and question
   */
  static async findByUserAndQuestion(user_id, programming_question_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM programming_submissions WHERE user_id = ? AND programming_question_id = ?',
      [user_id, programming_question_id]
    );
    return rows[0] || null;
  }

  /**
   * Find by ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM programming_submissions WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find all submissions for a practice segment by user
   */
  static async findByUserAndPracticeSegment(user_id, practice_segment_id) {
    const [rows] = await pool.execute(
      `SELECT ps.*, q.title as question_title
       FROM programming_submissions ps
       JOIN questions q ON ps.programming_question_id = q.id
       WHERE ps.user_id = ? AND ps.practice_segment_id = ?`,
      [user_id, practice_segment_id]
    );
    return rows;
  }

  /**
   * Get submission history
   */
  static async getHistory(programming_submission_id) {
    const [rows] = await pool.execute(
      `SELECT * FROM programming_submission_history 
       WHERE programming_submission_id = ?
       ORDER BY attempt_number ASC`,
      [programming_submission_id]
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
         SUM(CASE WHEN successful_submission = TRUE THEN 1 ELSE 0 END) as successful,
         AVG(best_score) as avg_best_score,
         SUM(submission_count) as total_submissions
       FROM programming_submissions
       WHERE user_id = ? AND practice_segment_id = ?`,
      [user_id, practice_segment_id]
    );
    return rows[0];
  }

  /**
   * Get all programming submissions for a user in a course
   */
  static async findByUserAndCourse(user_id, course_id) {
    const [rows] = await pool.execute(
      `SELECT ps.*, q.title as question_title, psg.name as practice_segment_name
       FROM programming_submissions ps
       JOIN submissions s ON ps.submission_id = s.id
       JOIN questions q ON ps.programming_question_id = q.id
       JOIN practice_segments psg ON ps.practice_segment_id = psg.id
       WHERE ps.user_id = ? AND s.course_id = ?`,
      [user_id, course_id]
    );
    return rows;
  }
}

module.exports = ProgrammingSubmission;

