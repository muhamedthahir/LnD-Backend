const pool = require('../config/db');

class Enrollment {
  static async create(enrollmentData) {
    const { student_id, course_id, status } = enrollmentData;
    const [result] = await pool.execute(
      'INSERT INTO enrollments (student_id, course_id, status) VALUES (?, ?, ?)',
      [student_id, course_id, status || 'invited']
    );
    return result.insertId;
  }

  static async findByStudentId(student_id, status = null) {
    let query = `SELECT e.*, c.name as course_name, c.description as course_description 
       FROM enrollments e 
       JOIN courses c ON e.course_id = c.id 
       WHERE e.student_id = ?`;
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

  static async delete(student_id, course_id) {
    await pool.execute(
      'DELETE FROM enrollments WHERE student_id = ? AND course_id = ?',
      [student_id, course_id]
    );
  }
}

module.exports = Enrollment;

