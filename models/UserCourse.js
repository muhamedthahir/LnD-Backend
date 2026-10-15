const pool = require('../config/db');

class UserCourse {
  /**
   * Create or update user-course relationship
   * @param {Object} userCourseData - { user_id, course_id, enrollment_id, status, progress_percentage, last_accessed_at }
   */
  static async createOrUpdate(userCourseData) {
    const { 
      user_id, 
      course_id, 
      enrollment_id,
      status = 'in_progress',
      progress_percentage = 0,
      last_accessed_at = new Date()
    } = userCourseData;

    // Check if record exists
    const existing = await this.findByUserAndCourse(user_id, course_id);
    
    if (existing) {
      // Update existing record
      const updates = [];
      const values = [];
      
      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status);
      }
      if (progress_percentage !== undefined) {
        updates.push('progress_percentage = ?');
        values.push(progress_percentage);
      }
      if (last_accessed_at !== undefined) {
        updates.push('last_accessed_at = ?');
        values.push(last_accessed_at);
      }
      if (enrollment_id !== undefined) {
        updates.push('enrollment_id = ?');
        values.push(enrollment_id);
      }
      
      values.push(user_id, course_id);
      
      await pool.execute(
        `UPDATE user_courses SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND course_id = ?`,
        values
      );
      return existing.id;
    } else {
      // Create new record
      const [result] = await pool.execute(
        `INSERT INTO user_courses (user_id, course_id, enrollment_id, status, progress_percentage, last_accessed_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [user_id, course_id, enrollment_id || null, status, progress_percentage, last_accessed_at]
      );
      return result.insertId;
    }
  }

  /**
   * Find user-course relationship
   */
  static async findByUserAndCourse(user_id, course_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM user_courses WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );
    return rows[0] || null;
  }

  /**
   * Get all courses for a user
   */
  static async findByUserId(user_id) {
    const [rows] = await pool.execute(
      `SELECT uc.*, c.name as course_name, c.category, c.competency_level, c.thumbnail
       FROM user_courses uc
       JOIN courses c ON uc.course_id = c.id
       WHERE uc.user_id = ?
       ORDER BY uc.last_accessed_at DESC`,
      [user_id]
    );
    return rows;
  }

  /**
   * Update progress
   */
  static async updateProgress(user_id, course_id, progress_percentage) {
    await pool.execute(
      `UPDATE user_courses 
       SET progress_percentage = ?, last_accessed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND course_id = ?`,
      [progress_percentage, user_id, course_id]
    );
  }

  /**
   * Update status
   */
  static async updateStatus(user_id, course_id, status) {
    await pool.execute(
      `UPDATE user_courses 
       SET status = ?, last_accessed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND course_id = ?`,
      [status, user_id, course_id]
    );
  }

  /**
   * Mark lesson/segment as completed
   */
  static async markSegmentCompleted(user_id, course_id, segment_id) {
    // Check if already completed
    const [existing] = await pool.execute(
      'SELECT * FROM user_course_segments WHERE user_id = ? AND course_id = ? AND segment_id = ?',
      [user_id, course_id, segment_id]
    );

    if (existing.length === 0) {
      await pool.execute(
        `INSERT INTO user_course_segments (user_id, course_id, segment_id, completed_at) 
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
        [user_id, course_id, segment_id]
      );
    }

    // Recalculate progress
    await this.recalculateProgress(user_id, course_id);
  }

  /**
   * Recalculate course progress
   */
  static async recalculateProgress(user_id, course_id) {
    // Get total segments in course
    const [totalSegments] = await pool.execute(
      `SELECT COUNT(*) as total FROM segments s
       JOIN topics t ON s.topic_id = t.id
       WHERE t.course_id = ?`,
      [course_id]
    );

    // Get completed segments
    const [completedSegments] = await pool.execute(
      `SELECT COUNT(*) as completed FROM user_course_segments
       WHERE user_id = ? AND course_id = ?`,
      [user_id, course_id]
    );

    const total = totalSegments[0]?.total || 0;
    const completed = completedSegments[0]?.completed || 0;
    const progress_percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    await this.updateProgress(user_id, course_id, progress_percentage);

    // Update status to completed if 100%
    if (progress_percentage === 100) {
      await this.updateStatus(user_id, course_id, 'completed');
    }

    return progress_percentage;
  }

  /**
   * Get course progress details
   */
  static async getProgressDetails(user_id, course_id) {
    const userCourse = await this.findByUserAndCourse(user_id, course_id);
    if (!userCourse) {
      return null;
    }

    // Get completed segments
    const [completedSegments] = await pool.execute(
      `SELECT segment_id, completed_at FROM user_course_segments
       WHERE user_id = ? AND course_id = ?`,
      [user_id, course_id]
    );

    return {
      ...userCourse,
      completed_segments: completedSegments.map(s => s.segment_id),
      completed_segments_details: completedSegments
    };
  }

  /**
   * Create table if not exists
   */
  static async createTable() {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        course_id INT NOT NULL,
        enrollment_id INT NULL,
        status ENUM('in_progress', 'completed', 'paused', 'not_started', 'expired') NOT NULL DEFAULT 'not_started',
        progress_percentage INT DEFAULT 0,
        last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP NULL,
        completed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_course (user_id, course_id),
        INDEX idx_user_id (user_id),
        INDEX idx_course_id (course_id),
        INDEX idx_status (status),
        INDEX idx_last_accessed (last_accessed_at)
      )
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_course_segments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        course_id INT NOT NULL,
        segment_id INT NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_segment (user_id, course_id, segment_id),
        INDEX idx_user_course (user_id, course_id),
        INDEX idx_segment_id (segment_id)
      )
    `);
  }
}

module.exports = UserCourse;

