const pool = require('../config/db');

class Course {
  static async create(courseData) {
    const { name, description, created_by } = courseData;
    const [result] = await pool.execute(
      'INSERT INTO courses (name, description, created_by) VALUES (?, ?, ?)',
      [name, description, created_by]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM courses WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async getAll(limit = 50, offset = 0) {
    const [rows] = await pool.execute(
      'SELECT c.*, u.name as creator_name FROM courses c LEFT JOIN users u ON c.created_by = u.id LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows;
  }

  static async update(id, courseData) {
    const { name, description } = courseData;
    await pool.execute(
      'UPDATE courses SET name = ?, description = ? WHERE id = ?',
      [name, description, id]
    );
  }

  static async delete(id) {
    await pool.execute('DELETE FROM courses WHERE id = ?', [id]);
  }

  static async getWithTopics(id) {
    const [course] = await pool.execute(
      'SELECT * FROM courses WHERE id = ?',
      [id]
    );
    
    if (!course[0]) return null;

    const [topics] = await pool.execute(
      'SELECT * FROM topics WHERE course_id = ? ORDER BY order_index',
      [id]
    );

    return { ...course[0], topics };
  }
}

module.exports = Course;

