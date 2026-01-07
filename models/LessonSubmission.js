const pool = require('../config/db');
const Submission = require('./Submission');

class LessonSubmission {
  /**
   * Create or update lesson submission (called when user launches a lesson)
   * @param {Object} data - { user_id, segment_id, topic_id, course_id }
   */
  static async createOrUpdate(data) {
    const { user_id, segment_id, topic_id, course_id } = data;
    
    // Check if submission exists
    const existing = await this.findByUserAndSegment(user_id, segment_id);
    
    if (existing) {
      // Update existing - increment access count, update last accessed
      await pool.execute(
        `UPDATE lesson_submissions 
         SET access_count = access_count + 1,
             last_accessed_at = CURRENT_TIMESTAMP,
             status = CASE WHEN status = 'not_started' THEN 'in_progress' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [existing.id]
      );
      
      // Create access history entry
      await this.createAccessHistory(existing.id, existing.access_count + 1, existing.progress_percentage);
      
      return existing.id;
    } else {
      // Create base submission first
      const submissionId = await Submission.create({
        user_id,
        course_id,
        submission_type: 'lesson'
      });
      
      // Create lesson submission
      const [result] = await pool.execute(
        `INSERT INTO lesson_submissions 
         (submission_id, user_id, segment_id, topic_id, course_id, status, access_count, first_accessed_at, last_accessed_at)
         VALUES (?, ?, ?, ?, ?, 'in_progress', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [submissionId, user_id, segment_id, topic_id, course_id]
      );
      
      // Create first access history entry
      await this.createAccessHistory(result.insertId, 1, 0);
      
      return result.insertId;
    }
  }

  /**
   * Create access history entry
   */
  static async createAccessHistory(lessonSubmissionId, sessionNumber, progressBefore) {
    await pool.execute(
      `INSERT INTO lesson_access_history 
       (lesson_submission_id, session_number, started_at, progress_before)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
      [lessonSubmissionId, sessionNumber, progressBefore]
    );
  }

  /**
   * End access session (update duration and progress)
   */
  static async endAccessSession(lessonSubmissionId, progressAfter) {
    // Get the latest access history entry
    const [history] = await pool.execute(
      `SELECT * FROM lesson_access_history 
       WHERE lesson_submission_id = ? 
       ORDER BY session_number DESC LIMIT 1`,
      [lessonSubmissionId]
    );
    
    if (history.length > 0 && !history[0].ended_at) {
      const duration = Math.floor((Date.now() - new Date(history[0].started_at).getTime()) / 1000);
      
      await pool.execute(
        `UPDATE lesson_access_history 
         SET ended_at = CURRENT_TIMESTAMP, 
             duration_seconds = ?,
             progress_after = ?
         WHERE id = ?`,
        [duration, progressAfter, history[0].id]
      );
      
      // Update total time spent in main submission
      await pool.execute(
        `UPDATE lesson_submissions 
         SET total_time_spent_seconds = total_time_spent_seconds + ?,
             progress_percentage = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [duration, progressAfter, lessonSubmissionId]
      );
    }
  }

  /**
   * Update progress
   */
  static async updateProgress(user_id, segment_id, progress_percentage) {
    const existing = await this.findByUserAndSegment(user_id, segment_id);
    
    if (existing) {
      let status = existing.status;
      let completed_at = existing.completed_at;
      
      if (progress_percentage >= 100) {
        status = 'completed';
        completed_at = new Date();
      } else if (progress_percentage > 0) {
        status = 'in_progress';
      }
      
      await pool.execute(
        `UPDATE lesson_submissions 
         SET progress_percentage = ?,
             status = ?,
             completed_at = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [progress_percentage, status, completed_at, existing.id]
      );
      
      return existing.id;
    }
    return null;
  }

  /**
   * Mark lesson as complete
   */
  static async markComplete(user_id, segment_id) {
    const existing = await this.findByUserAndSegment(user_id, segment_id);
    
    if (existing) {
      await pool.execute(
        `UPDATE lesson_submissions 
         SET progress_percentage = 100,
             status = 'completed',
             completed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [existing.id]
      );
      return true;
    }
    return false;
  }

  /**
   * Find by user and segment
   */
  static async findByUserAndSegment(user_id, segment_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM lesson_submissions WHERE user_id = ? AND segment_id = ?',
      [user_id, segment_id]
    );
    return rows[0] || null;
  }

  /**
   * Find by ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM lesson_submissions WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find all by user and course
   */
  static async findByUserAndCourse(user_id, course_id) {
    const [rows] = await pool.execute(
      `SELECT ls.*, s.name as segment_name, s.segment_type
       FROM lesson_submissions ls
       JOIN segments s ON ls.segment_id = s.id
       WHERE ls.user_id = ? AND ls.course_id = ?`,
      [user_id, course_id]
    );
    return rows;
  }

  /**
   * Find all by user and topic
   */
  static async findByUserAndTopic(user_id, topic_id) {
    const [rows] = await pool.execute(
      `SELECT ls.*, s.name as segment_name, s.segment_type
       FROM lesson_submissions ls
       JOIN segments s ON ls.segment_id = s.id
       WHERE ls.user_id = ? AND ls.topic_id = ?`,
      [user_id, topic_id]
    );
    return rows;
  }

  /**
   * Get access history for a submission
   */
  static async getAccessHistory(lessonSubmissionId) {
    const [rows] = await pool.execute(
      `SELECT * FROM lesson_access_history 
       WHERE lesson_submission_id = ?
       ORDER BY session_number ASC`,
      [lessonSubmissionId]
    );
    return rows;
  }

  /**
   * Get lesson progress summary for a user's course
   */
  static async getProgressSummary(user_id, course_id) {
    const [rows] = await pool.execute(
      `SELECT 
         COUNT(*) as total_accessed,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
         AVG(progress_percentage) as avg_progress,
         SUM(total_time_spent_seconds) as total_time_spent
       FROM lesson_submissions
       WHERE user_id = ? AND course_id = ?`,
      [user_id, course_id]
    );
    return rows[0];
  }
}

module.exports = LessonSubmission;

