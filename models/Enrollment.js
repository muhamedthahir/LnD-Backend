const pool = require('../config/db');

class Enrollment {
  static async create(enrollmentData) {
    const { student_id, course_id, administration_id, user_id, status } = enrollmentData;
    // Support both old format (student_id, course_id) and new format (user_id, administration_id)
    const userId = user_id || student_id;
    const adminId = administration_id;
    const courseId = course_id;
    
    if (adminId) {
      // New format: enrollment for administration
      // Use student_id for backward compatibility with existing foreign key constraint
      const [result] = await pool.execute(
        'INSERT INTO enrollments (student_id, administration_id, status) VALUES (?, ?, ?)',
        [userId, adminId, status || 'invited']
      );
      return result.insertId;
    } else if (courseId) {
      // Old format: enrollment for course
      const [result] = await pool.execute(
        'INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, ?)',
        [userId, courseId, status || 'invited']
      );
      return result.insertId;
    } else {
      throw new Error('Either course_id or administration_id must be provided');
    }
  }

  static async findByStudentId(student_id, status = null) {
    // Handle both course_id enrollments and administration_id enrollments
    // Also include progress data from user_courses table
    let query = `SELECT 
      e.*,
      COALESCE(c.id, ca.course_id) as course_id,
      COALESCE(c.name, c2.name) as course_name,
      COALESCE(c.short_description, c2.short_description) as course_description,
      COALESCE(c.category, c2.category) as category,
      COALESCE(c.competency_level, c2.competency_level) as competency_level,
      COALESCE(c.status, c2.status) as course_status,
      COALESCE(c.thumbnail, c2.thumbnail) as thumbnail,
      COALESCE(c.has_to_go_by_section, c2.has_to_go_by_section, 0) as has_to_go_by_section,
      ca.start_date,
      ca.end_date,
      uc.progress_percentage,
      uc.status as user_course_status,
      uc.last_accessed_at,
      uc.started_at
    FROM enrollments e
    LEFT JOIN courses c ON e.course_id = c.id
    LEFT JOIN course_administrations ca ON e.administration_id = ca.id
    LEFT JOIN courses c2 ON ca.course_id = c2.id
    LEFT JOIN user_courses uc ON uc.user_id = e.student_id AND uc.course_id = COALESCE(c.id, ca.course_id)
    WHERE e.student_id = ? AND (e.course_id IS NOT NULL OR e.administration_id IS NOT NULL)`;
    const params = [student_id];
    
    if (status) {
      query += ' AND e.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY e.enrolled_at DESC';
    
    const [rows] = await pool.execute(query, params);
    return rows;
  }
  
  static async updateStatus(enrollment_id, status) {
    await pool.execute(
      'UPDATE enrollments SET status = ? WHERE id = ?',
      [status, enrollment_id]
    );
  }

  static async findByCourseId(course_id) {
    const [rows] = await pool.execute(
      `SELECT e.*, u.name as student_name, u.email as student_email 
       FROM enrollments e 
       JOIN users u ON e.student_id = u.id 
       WHERE e.course_id = ?`,
      [course_id]
    );
    return rows;
  }

  static async checkEnrollment(student_id, course_id) {
    const [rows] = await pool.execute(
      'SELECT * FROM enrollments WHERE student_id = ? AND course_id = ?',
      [student_id, course_id]
    );
    return rows[0];
  }

  /**
   * Check if a user is already enrolled in a course through any administration or direct enrollment
   * @param {number} student_id - The student/user ID
   * @param {number} course_id - The course ID
   * @returns {Object|null} - The existing enrollment if found, null otherwise
   */
  static async checkCourseEnrollment(student_id, course_id) {
    // Check direct course enrollment
    const directEnrollment = await this.checkEnrollment(student_id, course_id);
    if (directEnrollment) {
      return directEnrollment;
    }

    // Check enrollment through any administration for this course
    const [rows] = await pool.execute(
      `SELECT e.* 
       FROM enrollments e
       INNER JOIN course_administrations ca ON e.administration_id = ca.id
       WHERE e.student_id = ? AND ca.course_id = ?`,
      [student_id, course_id]
    );
    
    return rows[0] || null;
  }

  static async delete(student_id, course_id) {
    await pool.execute(
      'DELETE FROM enrollments WHERE student_id = ? AND course_id = ?',
      [student_id, course_id]
    );
  }
}

module.exports = Enrollment;

