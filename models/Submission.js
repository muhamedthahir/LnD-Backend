const pool = require('../config/db');

class Submission {
  /**
   * Create a new base submission
   * @param {Object} data - { user_id, course_id, submission_type }
   */
  static async create(data) {
    const { user_id, course_id, submission_type } = data;
    
    const [result] = await pool.execute(
      `INSERT INTO submissions (user_id, course_id, submission_type) VALUES (?, ?, ?)`,
      [user_id, course_id, submission_type]
    );
    
    return result.insertId;
  }

  /**
   * Find submission by ID
   */
  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM submissions WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find submissions by user and course
   */
  static async findByUserAndCourse(user_id, course_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM submissions WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );
    return rows;
  }

  /**
   * Find submissions by user, course and type
   */
  static async findByUserCourseAndType(user_id, course_id, submission_type) {
    const [rows] = await pool.execute(
      'SELECT * FROM submissions WHERE user_id = ? AND course_id = ? AND submission_type = ?',
      [user_id, course_id, submission_type]
    );
    return rows;
  }

  /**
   * Delete submission
   */
  static async delete(id) {
    const [result] = await pool.execute(
      'DELETE FROM submissions WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = Submission;

